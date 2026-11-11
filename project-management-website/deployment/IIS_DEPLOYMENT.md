# 本地 IIS 部署

## 部署结果

- 访问地址：`http://127.0.0.1:8080`（仅本机；不创建防火墙放行规则）。
- IIS 提供编译后的 React 静态文件，并将 `/api` 代理到 `127.0.0.1:5001`。
- Node.js 后端以低权限 **LocalService** 身份运行，由 Windows 开机计划任务自动启动，失败后每分钟重试，最多 999 次；不需要登录、打开终端或运行开发服务器。
- IIS 和 Node.js 必须保留。纯静态 IIS 托管不能处理数据库、附件和 API。
- 使用独立 IIS 站点根路径，不支持直接挂到现有网站的子目录。

## 1. 一次性准备

以管理员身份配置 Windows：

1. 在“启用或关闭 Windows 功能”中启用 **Internet Information Services**：
   - Web 管理工具 → IIS 管理控制台、IIS 管理脚本和工具。
   - 万维网服务 → 常见 HTTP 功能 → 静态内容、默认文档、HTTP 错误。
   - 万维网服务 → 安全性 → 请求筛选。
2. 安装 Microsoft 官方组件：
   - [IIS URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite)
   - [Application Request Routing 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)
3. 安装全机可用的 Node.js（建议 Node.js 24 LTS；最低 22.5），包含 npm。使用安装在 `C:\Program Files\nodejs` 的版本，不要使用仅当前用户可访问的版本管理器路径；LocalService 需要读取并执行 Node.js。
4. 重新打开 **64 位 Windows PowerShell 5.1（管理员）**，确认 `node --version` 和 `npm --version` 正常。

脚本不会自动安装 Windows 功能或下载安装程序，也不会配置公网访问。它会启用 IIS 的 ARR 服务器级代理设置；这项设置对当前 IIS 实例全局生效，不更改其他站点的代理规则。

## 2. 首次部署

先关闭原来的开发后端和前端窗口，暂停文件上传及数据修改。首次部署会导入当前数据；虽然数据库采用 SQLite 一致性快照，附件与数据库仍应在停止写入后一起迁移。

在管理员 Windows PowerShell 中执行：

```powershell
cd 'C:\AI Tools\project-management-website'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\deployment\deploy-iis.ps1'
```

完成后打开 **http://127.0.0.1:8080**。脚本只有在后端健康检查、IIS API 代理和 React 深链接检查全部通过后才报告成功。

默认发布布局（使用系统盘）：

```text
C:\inetpub\ProjectFlow\
  web\       IIS 网站根目录，只包含前端资源及 web.config
  server\    编译后的后端、生产依赖、启动脚本
  data\      SQLite 数据库及全部附件，不在网站根目录下
  logs\      backend.log（启动时超过 10 MB 则保留一个轮换副本）
```

IIS 站点和应用池名称：`ProjectFlow`。计划任务名称：`ProjectFlow-Backend`。

**数据切换说明：**

- 首次部署复制开发数据及三类附件（C2C 合同、客户组织图、项目 SOW），原数据不修改。
- 发布后只有 `C:\inetpub\ProjectFlow\data` 是生产数据源；开发项目中的 `server\data` 不再与生产同步。
- 重复部署保留生产数据，不会用旧开发数据覆盖。
- 本应用没有登录保护。不要把站点绑定修改为所有网卡，也不要对公网开放；如需多人使用，应先增加认证与授权。

## 3. 更新和日常维护

修改代码后，重新运行同一部署命令。脚本先构建，再停止自己的站点和任务，更新生产文件并启动验证。更新期间网站短暂不可用；失败会明确报错，不提供自动回滚。先修正错误，再重新运行脚本。

不要删除整个发布目录来“更新”，否则会丢失生产数据。

管理员 PowerShell 的常用命令：

```powershell
# 查看后台状态
Get-ScheduledTask -TaskName ProjectFlow-Backend
Get-ScheduledTaskInfo -TaskName ProjectFlow-Backend
Invoke-RestMethod http://127.0.0.1:8080/api/health

# 查看日志
Get-Content 'C:\inetpub\ProjectFlow\logs\backend.log' -Tail 80

# 手动停止：先禁用自动任务，再停止任务；维护结束后重新启用并启动
Disable-ScheduledTask -TaskName ProjectFlow-Backend
Stop-ScheduledTask -TaskName ProjectFlow-Backend
Enable-ScheduledTask -TaskName ProjectFlow-Backend
Start-ScheduledTask -TaskName ProjectFlow-Backend
```

备份：停止站点以阻止新的请求，然后禁用并停止后端任务，确认 `5001` 不再监听，复制**整个生产 data 目录**（包括数据库和附件；如仍存在 WAL/SHM 文件也一并保留），再重新启用任务、启动任务和站点。不要只备份开发目录。

开机验证：部署成功后重启 Windows，不启动开发终端，直接访问 `http://127.0.0.1:8080`，确认页面、已有记录和附件仍可使用。

## 故障排查

- **缺少 IIS / Rewrite / ARR**：只安装 IIS 不够。按报错列出的链接下载官方 x64 安装包，先安装 URL Rewrite 2.1，再安装 ARR 3.0，以管理员身份运行安装程序。安装后重新打开 64 位管理员 Windows PowerShell，再运行部署脚本；如果安装程序要求重启，先完成重启。如果确认安装过但仍未注册模块，使用安装程序修复对应组件。
  可用以下只读命令确认模块注册情况（两个名称都应出现）：

  ```powershell
  Import-Module WebAdministration
  Get-WebGlobalModule | Where-Object { $_.Name -in @('RewriteModule', 'ApplicationRequestRouting') } | Select-Object Name, Image
  ```
- **500.19**：检查 URL Rewrite 是否安装，以及相关 IIS 配置节是否被系统策略锁定。`500 19 33` 与配置锁定相符；脚本将匿名身份验证及 WebDAV 的模块/处理程序排除项写入服务器配置中仅属于 ProjectFlow 的设置，避免在站点 `web.config` 中修改这些可能锁定的配置节。使用最新脚本重新部署，不要全局解锁。如果仍失败，在管理员窗口查看该站点 IIS 日志的 `sc-status`、`sc-substatus`、`sc-win32-status`，并检查本机 IIS 详细错误页中的配置文件、配置节和行号。
- **400 / Invalid Hostname**：站点仅绑定 IPv4 回环地址，请使用 `http://127.0.0.1:8080`。`localhost` 可能解析为 IPv6 的 `::1`，不匹配此绑定；不要为此改成所有网卡绑定。
- **502 / API unavailable**：检查计划任务、后端日志、Node.js 执行权限，以及 `http://127.0.0.1:5001/api/health`。
- **端口冲突**：开发服务器使用 5000；生产使用 5001 和 8080。首次导入时脚本会要求先停止 5000 上的开发后端。
- **数据库只读 / 附件不能保存**：LocalService 需要对生产 `data` 和 `logs` 拥有修改权限；脚本会设置，不要把数据放在 IIS 静态目录中。
- **Node.js 位于用户目录**：换成全机 Node.js 安装，再重新部署。生产任务使用部署时记录的 Node.js 绝对路径；升级或迁移 Node.js 后应重新部署。
- **脚本被安全策略阻止**：按组织策略由管理员放行，勿绕过组织管控。
- **更新中途失败**：站点可能处于停止状态，任务可能被禁用。根据报错修复后重新部署；生产数据保留。检查 Windows 任务计划程序的任务历史可了解启动失败原因。

## 开发方式保持不变

原来的 `run-project.bat` 及前后端 `npm start` 仍用于开发（3000 / 5000）。

后端新增 `npm run build`、`npm run start:prod`，支持环境变量：

| 变量 | 默认值 | IIS 部署值 |
|---|---|---|
| `HOST` | `0.0.0.0` | `127.0.0.1` |
| `PORT` | `5000` | `5001` |
| `DATA_DIRECTORY` | 后端目录下的 `data` | 独立生产 `data` 目录 |

`DATA_DIRECTORY` 同时控制数据库和全部附件的位置。

开发者验证命令（从项目根目录运行）：

```powershell
npm --prefix server run build
node --test .\deployment\deployment.test.cjs
npm --prefix client run build
npm --prefix client test
```

部署集成测试使用临时目录，不读写真实业务数据库；覆盖环境变量路径、全部附件、重启持久化和 WAL 数据库快照。
