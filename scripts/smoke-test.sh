#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-af-tools:smoke}"
CONTAINER="${CONTAINER:-af-tools-smoke}"
PORT="${PORT:-3311}"
BASE_URL="http://127.0.0.1:${PORT}"
WORK_DIR="$(mktemp -d)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building image ${IMAGE}"
  docker build -t "$IMAGE" .
fi

echo "==> Starting container"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -p "${PORT}:3000" "$IMAGE" >/dev/null

echo "==> Waiting for health check"
for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "${BASE_URL}/api/health" >/dev/null
echo "    healthy"

echo "==> Generating a 1.5s test video inside the container"
docker exec "$CONTAINER" ffmpeg -hide_banner -loglevel error \
  -f lavfi -i testsrc=size=320x240:rate=15 -t 1.5 -pix_fmt yuv420p \
  /tmp/smoke-input.mp4
docker cp "${CONTAINER}:/tmp/smoke-input.mp4" "${WORK_DIR}/input.mp4" >/dev/null

echo "==> Creating conversion job"
response="$(curl -fsS \
  -F 'options={"fps":10,"width":320,"startTime":0,"duration":"full","loop":true}' \
  -F "file=@${WORK_DIR}/input.mp4;type=video/mp4" \
  "${BASE_URL}/api/tools/mp4-to-gif/jobs")"

job_id="$(node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (!data.jobId) process.exit(1);
  process.stdout.write(data.jobId);
' <<<"$response")"
echo "    job ${job_id}"

echo "==> Waiting for job completion"
status=""
for _ in $(seq 1 90); do
  snapshot="$(curl -fsS "${BASE_URL}/api/jobs/${job_id}")"
  status="$(node -e '
    const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
    process.stdout.write(data.status);
  ' <<<"$snapshot")"

  if [[ "$status" == "completed" ]]; then
    break
  fi
  if [[ "$status" == "failed" || "$status" == "cancelled" || "$status" == "expired" ]]; then
    echo "$snapshot" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$status" != "completed" ]]; then
  echo "Timed out waiting for job (last status: ${status})" >&2
  exit 1
fi

echo "==> Downloading result"
curl -fsS -o "${WORK_DIR}/result.gif" "${BASE_URL}/api/jobs/${job_id}/result"

node -e '
  const fs = require("fs");
  const path = process.argv[1];
  const buffer = fs.readFileSync(path);
  if (buffer.length < 1000) throw new Error("GIF is unexpectedly small");
  if (buffer.subarray(0, 3).toString() !== "GIF") throw new Error("Not a GIF");
  console.log(`    received ${buffer.length} bytes`);
' "${WORK_DIR}/result.gif"

echo "==> Testing cancel endpoint with a second job"
second="$(curl -fsS \
  -F 'options={"fps":10,"width":320}' \
  -F "file=@${WORK_DIR}/input.mp4;type=video/mp4" \
  "${BASE_URL}/api/tools/mp4-to-gif/jobs")"
second_id="$(node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  process.stdout.write(data.jobId);
' <<<"$second")"
curl -fsS -X DELETE "${BASE_URL}/api/jobs/${second_id}" >/dev/null

echo "Smoke test passed."
