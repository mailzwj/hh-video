# HHVideo

基于阿里云百炼 DashScope API 的 AI 视频生成桌面客户端。

## 功能

- 文生视频 / 图生视频双模型支持
- 可选分辨率（720P / 1080P）、宽高比（9:16 / 16:9）、时长（5s / 10s）
- 提交后自动轮询任务状态，生成完成直接播放视频
- API Key 全局配置，菜单栏设置

## 使用

```bash
npm start
```

或构建打包后，进入 `release` 目录通过安装包安装。

首次使用在菜单栏 `HHVideo > 设置` 中填入 DashScope API Key。
