# 视频网格播放器 (Video Grid Player)

![Video Grid Player Preview](docs/preview.png)

一个简单、高效的视频网格播放器网页应用，支持批量视频预览、过滤和管理。

🔗 在线使用: [https://video-grid-player.vercel.app/](https://video-grid-player.vercel.app/)

## 主要功能

- **批量视频预览**: 一次性加载并预览大量视频文件
- **拖放上传**: 支持拖放文件和文件夹直接上传
- **自动布局**: 自动排列视频为网格布局，支持响应式设计
- **性能优化**: 虚拟滚动和懒加载技术，即使处理大量视频也能保持流畅
- **文件过滤**: 可以按类型过滤（仅显示视频，隐藏图片）
- **视频截图**: 可以对单个视频或所有视频进行截图
- **批量下载**: 一键下载所有视频文件
- **文件夹结构**: 保留并显示原始文件夹结构
- **云端上传**: 支持上传到Supabase云存储(可选功能)
- **视频编号**: 每个视频都有唯一序号，方便定位

## 使用方法

1. 拖放视频或图片文件到浏览区域，或点击选择文件
2. 也可以直接拖入整个文件夹，程序会保留文件夹结构
3. 上传的媒体文件会自动排列为网格
4. 使用顶部的控制按钮筛选、截图或下载视频
5. 鼠标悬停在视频上时会自动播放声音
6. 点击视频右上角的X按钮可以移除单个视频
7. 点击截图按钮可以保存当前帧为图片

## 技术实现

- 纯原生JavaScript，无需任何框架
- HTML5视频和拖放API
- 使用虚拟滚动和懒加载优化性能
- Supabase集成用于云端存储(可选)
- 响应式设计，适配各种设备

## 本地部署

1. 克隆仓库
```bash
git clone https://github.com/yourname/video-grid-player.git
cd video-grid-player
```

2. 使用任何HTTP服务器启动项目
```bash
# 使用Python简易HTTP服务器
python -m http.server

# 或使用Node.js的http-server
npx http-server
```

3. 打开浏览器访问 `http://localhost:8000/public/player.html`

## 许可证

MIT

## 致谢

- 图标来自 [flaticon.com](https://www.flaticon.com/)
- 感谢所有测试和提供反馈的用户
