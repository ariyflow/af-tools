# AF Tools

一个自托管、可扩展的媒体工具箱。当前内置 **MP4 转 GIF**，转换在服务端通过 FFmpeg 完成，支持实时进度、任务取消、结果预览与自动清理。

## 特性

- **服务端 FFmpeg**：两遍调色板算法，生成质量更好的 GIF
- **异步任务框架**：上传 → 排队 → 转换 → 预览/下载，支持 SSE 实时进度
- **可扩展工具注册**：新增工具只需要一个前端目录 + 一个服务端 handler
- **中英双语**、明暗主题、响应式布局
- **安全默认值**：上传大小/时长限制、并发限制、超时、速率限制、临时文件清理
- **单容器部署**：Node 同时提供 API 与静态前端，内置健康检查

## 快速开始

```bash
docker compose up -d --build
```

打开 <http://localhost:45100>。

`ports` 的格式是 `宿主机端口:容器端口`，当前为 `45100:3000`：宿主机通过 45100 访问，容器内应用固定监听 3000。如需修改宿主机端口，只改冒号左边，例如 `8080:3000`；不要修改环境变量 `PORT`，它需要与容器端口保持一致。

常用运维命令：

```bash
docker compose ps
docker compose logs -f
docker compose down
```

也可以直接使用 Docker：

```bash
docker build -t af-tools:latest .
docker run -d --name af-tools -p 45100:3000 --restart unless-stopped af-tools:latest
```

## 本地开发

要求：

- Node.js 22+
- FFmpeg（`ffmpeg` 与 `ffprobe` 在 PATH 中）

```bash
npm install
npm run dev
```

- 前端：<http://localhost:5173>
- API：<http://localhost:3000>
- Vite 会将 `/api` 代理到后端

生产构建：

```bash
npm run build
npm start
```

## 环境变量

| 变量                      | 默认值                 | 说明                      |
| ------------------------- | ---------------------- | ------------------------- |
| `PORT`                    | `3000`                 | 监听端口                  |
| `HOST`                    | `0.0.0.0`              | 监听地址                  |
| `MAX_UPLOAD_MB`           | `200`                  | 单文件大小上限            |
| `MAX_DURATION_SECONDS`    | `60`                   | 单次转换最大时长          |
| `JOB_CONCURRENCY`         | `2`                    | 同时运行的 FFmpeg 任务数  |
| `MAX_QUEUED_JOBS`         | `JOB_CONCURRENCY * 10` | 队列上限，超出返回 429    |
| `JOB_TTL_MINUTES`         | `60`                   | 结果保留时间              |
| `PROCESS_TIMEOUT_SECONDS` | `180`                  | 单个 FFmpeg 进程超时      |
| `FFMPEG_PATH`             | `ffmpeg`               | FFmpeg 可执行文件         |
| `FFPROBE_PATH`            | `ffprobe`              | FFprobe 可执行文件        |
| `TEMP_DIR`                | 系统临时目录           | 上传文件与结果存放目录    |
| `TRUST_PROXY`             | `false`                | 位于反向代理后设为 `true` |
| `LOG_LEVEL`               | `info`                 | Pino 日志级别             |

## 架构

```text
src/
├── shared/                 前后端共享类型与 Zod schema
├── server/
│   ├── core/               任务队列、任务生命周期、临时存储
│   ├── lib/                FFmpeg / FFprobe / 子进程封装
│   ├── routes/             health / tools / jobs API
│   └── tools/              服务端工具注册表与 handler
└── web/
    ├── components/         通用 UI 组件
    ├── composables/        主题、能力查询、任务客户端
    ├── layouts/            应用外壳
    ├── pages/              首页、通用工具页
    └── tools/              工具注册表与具体工具 UI
```

### 任务 API

```text
GET    /api/health
GET    /api/tools
POST   /api/tools/:toolId/jobs       multipart: file + options(JSON)
GET    /api/jobs/:jobId
GET    /api/jobs/:jobId/events       SSE
GET    /api/jobs/:jobId/result
DELETE /api/jobs/:jobId
```

任务状态：

```text
queued → processing → completed
                    ↘ failed
         ↘ cancelled
completed → expired
```

任务存储在进程内存中。服务重启后未完成/未过期的任务会失效，临时目录会在启动时清空。`JobStore` 与 `JobQueue` 已抽象，后续可以替换为 Redis/BullMQ。

## 新增一个工具

1. **共享参数 schema**：在 `src/shared/tools/` 新增 Zod schema 与类型。
2. **前端工具目录**：在 `src/web/tools/<tool>/` 新增：
   - `index.ts`：导出 `meta`、懒加载组件、工具级 i18n 文案
   - `<Tool>.vue`：工具界面
3. **服务端 handler**：在 `src/server/tools/<tool>/` 实现 `run`，并在 `src/server/tools/registry.ts` 注册。
4. 完成。首页卡片、侧边栏、路由和任务 API 会自动生效。

前端 `registry.ts` 使用 `import.meta.glob` 自动发现工具；服务端 `registry.ts` 维护工具能力与 handler 映射。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

容器端到端冒烟测试（会构建镜像、生成测试视频、执行转换并校验 GIF）：

```bash
./scripts/smoke-test.sh

# 复用已构建的镜像
IMAGE=af-tools:latest SKIP_BUILD=1 ./scripts/smoke-test.sh
```

## 说明

- 生成的 GIF 结果会在 `JOB_TTL_MINUTES` 后失效并清理。
- 前端优先使用 SSE 获取进度，连接失败时自动降级为轮询。
- 取消任务会终止对应的 FFmpeg 子进程并删除临时文件。
