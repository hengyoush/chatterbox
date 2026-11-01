# 直播声音采集分支

基于 laplace-live/chatterbox 4.8.0，保留原项目服务商、转录语言和同传功能。

## 使用

1. 安装 apps/chatterbox/dist/laplace-chatterbox.user.js；与原脚本同名、同 namespace，会替换原版本并保留设置。
2. 打开并播放 B 站直播，点击「直播助手」→「同传」。
3. 音频来源选择「直播播放器（直接采集）」。不需要麦克风或虚拟声卡。
4. 配置识别服务。智谱可使用「本地 / OpenAI 兼容」，地址 https://open.bigmodel.cn/api/paas/v4，模型 glm-asr-2512，填写自己的 API Key。
5. 只需要本地文字时，关闭「自动发送」后开始识别。
6. 播放器限制采集时，选择「标签页音频（备用）」，在浏览器弹窗中选择直播标签页并勾选共享音频。

采集的是直播播放器输出的混合音轨，包含直播流中的主播、动画、电视剧、游戏等声音；不自动分离说话人。可识别的语言和翻译能力取决于所选服务及模型，语言选项不会让模型获得本身不支持的语言。

停止、取消、服务错误、播放器移除或共享结束后会释放采集音轨。采集失败不会自动切换到麦克风。

## 构建与验证

使用 Bun 1.4.4：

~~~sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run --bun --cwd apps/chatterbox build
~~~

545 项单元及回归测试通过，包含 12 项直播采集测试。构建时使用 Bun，或使用满足 Vite 8 要求的 Node.js。实际直播验证结果在完成后另行记录。API Key 不包含在源码或安装包中。
