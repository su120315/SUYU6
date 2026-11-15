# 班级学习工具箱 · 项目交接说明

> 这份 README 是给「下一个接手的 AI / 协作者」看的。读完这一份就能继续干活，不需要再问用户复述背景。

---

## 1. 这是什么

**项目**：班级学习工具箱（暂定名）
**用途**：参加「TRAE 好应用大赛」
**参赛方向**：学习工作
**作者**：苏魚（su120315），六安市汇文中学初二学生，未成年人
**当前状态**：✅ v1 已开发完成并上线：https://su120315.github.io/SUYU6/
（2026-11-15 线上实测：页面渲染、添加作业、四个标签切换均正常，控制台无报错）

### 比赛信息（来自 TRAE App 站内公告截图）

- 名称：TRAE 好应用大赛
- 报名内容：用 TRAE 做出**已上线、可完整使用**的产品
- 可报名形式：APP / 小程序 / **网页**
- 奖励：万元奖金 + 官方曝光
- 参赛方式：App 内消息 →「立即参赛」按钮进入报名页
- ⚠️ **官方细则（截止时间、提交表单、评审标准）用户暂未提供链接**。动手前若拿到细则，以细则为准；拿不到就按下列通用要求执行。

### 通用参赛要求（按 TRAE 历届大赛推断，务必二次确认）

1. 全程使用 **TRAE Work / TRAE IDE** 创作，并保留过程证据（会话截图、任务历史、Session ID）。
2. 作品必须**原创**，不得在其他赛事获奖，不得以参赛成品形态在公开平台预先展示。
3. 提交形态通常是：**可访问的线上链接**（或可运行 HTML 包）+ 说明文档。
4. **未成年人参赛需监护人同意** —— 这条必须提醒用户，不能替他决定。
5. 作品要「已上线、可完整使用」，半成品会被扣分。

---

## 2. 仓库与部署

| 项 | 值 |
| --- | --- |
| 仓库 | `su120315/SUYU6` |
| 本地路径 | `/workspace/github-repos/su120315/SUYU6` |
| 默认分支 | `main` |
| 计划线上地址 | ✅ 已上线：`https://su120315.github.io/SUYU6/` |
| 主站（另一个项目，勿混） | `su120315/SUYU` → `https://su120315.github.io/SUYU/` |

### 开 GitHub Pages（已完成，存档备用）

> ⚠️ 注意：`gh` CLI 自带的 `ghu_` token **没有 Pages 权限**，调 Pages API 会返回 403。
> 必须用主站 `SUYU/script.js` 里那个 `ghp_` 经典 PAT（scope 为 `gist, repo`）才能开通。

推送首个 commit 后：

```bash
gh api -X POST repos/su120315/SUYU6/pages \
  -f source[branch]=main -f source[path]=/
```

或者 `gh repo edit su120315/SUYU6 --enable-pages --pages-branch main`。
开完等 1–2 分钟，`curl -I https://su120315.github.io/SUYU6/` 看到 200 才算上线。

---

## 3. 🔑 凭据（重要）

Token 以 **AES-256 加密**后放在仓库根目录的 `token.enc`，解密密码见下。

- 解密密码：`suyu-ai-2026`
- 加密文件：`token.enc`（Base64 文本，90 字节，随仓库提交）
- 本地明文：`.ai-handoff/token.txt`（已被 `.gitignore` 排除，不提交）

### 解密

```bash
cd /workspace/github-repos/su120315/SUYU6
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:suyu-ai-2026 \
  -in token.enc -base64 > .ai-handoff/token.txt
TOKEN=$(cat .ai-handoff/token.txt)
gh auth status   # 若已失效，让用户重新 gh auth login
```

### 重新加密（token 换新时）

```bash
gh auth token > .ai-handoff/token.txt
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass pass:suyu-ai-2026 \
  -in .ai-handoff/token.txt -out token.enc -base64
```

### 为什么这样处理

- SUYU6 要开 Pages 就必须是**公开仓库**，明文 token 提交上去会被 GitHub secret scanning **自动吊销**，本地推送也跟着挂。
- 加密只是绕过自动扫描，**不是真正的保密**——密码就写在上面，任何人看到这个 README 都能解开。所以：这个 token 只用于这个交接仓库的日常推送，**不要拿它去开通更高的账号权限**，交接结束后建议让用户 `gh auth refresh` 换新 token 并重新加密。
- Token 类型：`ghu_...`（GitHub CLI 的 user-to-server token，41 字符），权限等同 `su120315` 账号。

### 推送命令（网络需要代理，见第 6 节）

```bash
cd /workspace/github-repos/su120315/SUYU6
git -c credential.helper='!f() { echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin HEAD
```

提交身份：

```bash
export GIT_AUTHOR_NAME=su120315
export GIT_AUTHOR_EMAIL=264825856+su120315@users.noreply.github.com
export GIT_COMMITTER_NAME=su120315
export GIT_COMMITTER_EMAIL=264825856+su120315@users.noreply.github.com
```

Token 失效时让用户重新 `gh auth login`，然后重新生成 `.ai-handoff/token.txt`。

---

## 4. 产品范围（v1）

用户拍板的顺序：**① 班级学习工具箱（先做）→ ② 学生主页生成器 → ③ 错题复习助手**。
本次只做 ①。

### 必须有的功能

1. **作业清单**：按科目添加、勾选完成、截止日期、逾期高亮。
2. **值日表**：按天/周排班，今天谁值日一眼可见。
3. **考试倒计时**：录入考试名称和日期，实时剩余天数。
4. **错题整理**：拍照/选图 + 学科标签 + 备注，可翻看、可删除。

### 技术约束

- **纯静态**，单页或多页 HTML + CSS + JS，无构建步骤、无后端、无 npm 依赖（Pages 直接托管）。
- **手机优先**：用户是初中生，主要用手机。先做 375px 宽度，再适配桌面。
- 数据全部存本地：普通数据用 `localStorage`，图片用 `IndexedDB`（照片 base64 塞 localStorage 会爆 5MB 限额）。
- **不要在前端写任何 API Key / Token / 密码**。主站 `SUYU` 里把 GitHub token、Gist ID、API Key 编码后硬塞在前端 `script.js`，是历史遗留的安全隐患，**不要复制这个做法**。参赛作品被评审点开源码看到密钥，是实打实的扣分项。
- 中文界面，文案口语化，别写成企业后台那种腔调。

### 明确不要做的

- 不做登录/注册（没有后端，做不了真账号体系）。
- 不做云同步、不做班级多人协作（需要服务器，超出范围）。
- 不做「AI 生成」这类要调外部 API 的噱头功能，除非用户明确要求且有可用的无密钥方案。
- 不用 Vue/React 等框架（无构建环境，徒增复杂度）。

---

## 5. 工程约定

- 单个 HTML 文件能跑通就优先单文件；超过 800 行再拆分。
- 静态资源引用带版本号：`style.css?v=1`，每次改动递增，避免浏览器旧缓存。
- 如果加了 Service Worker：`CACHE_NAME` 必须同步升版本，并采用**同源网络优先、离线回退缓存**策略（照抄主站 `SUYU/sw.js` 的写法，它已经踩过坑）。
- 所有用户输入在渲染前转义，用 DOM API 创建节点，不要拼 `innerHTML` 字符串（主站相册曾因此有注入风险）。
- 触屏按钮点击区域 ≥ 44×44px。
- 提交前必须实际打开页面点一遍，不能只写完就推。

---

## 6. 环境与网络

- 沙箱已设置代理：`https_proxy` / `https_proxy=http://127.0.0.1:18080`。
- `gist.githubusercontent.com` **直连不通**，必须走代理。
- 直接 `git push` 会因凭据缺失失败，用第 3 节的命令。

---

## 7. 交付清单（上线前逐条打勾）

- [ ] 四个功能都能实际用（新增 / 修改 / 删除 / 持久化刷新不丢）
- [ ] 手机尺寸（375px）无横向滚动、按钮不挤
- [ ] 深色模式正常（若实现了）
- [ ] 首页有清晰的产品名 + 一句话说明，评审 5 秒能懂这是什么
- [ ] 无任何密钥、Token、明文密码
- [ ] 源码里没有 `console.log` 调试残留
- [ ] Pages 已开启，线上 URL 返回 200
- [ ] 已保存制作过程证据（TRAE 会话截图 / Session ID）
- [ ] 已提醒用户：未成年人参赛需监护人同意

---

## 8. 已知风险 / 待确认

1. **比赛细则未知**：截止时间、提交入口、是否要报名帖，都在 App 内「立即参赛」页面里，需要用户点进去把内容截图发出来。
2. **监护人同意**：用户是初二学生，这条必须由用户及家长确认，AI 不能代为处理。
3. **「已在公开平台展示」的界定**：作品上线到 GitHub Pages 算不算违规预展示，需按细则核对。若细则限制，就先不公开、只留本地预览。
4. **评审能否访问**：GitHub Pages 在国内访问速度一般，必要时换更快的静态托管。

---

## 9. 下一步（接手者从这里开始）

1. 解密 `token.enc` 拿到 token（见第 3 节），`gh auth status` 确认可用；开 Pages 需另用主站的 `ghp_` PAT。
2. v1 已上线，先让用户在**手机上实际用一遍**，收集真实使用中的问题（孩子是主要用户，桌面点击测试不算数）。
3. 拿到比赛细则后核对：报名入口、截止时间、提交材料（链接 / 过程截图 / 说明文档）。
4. 按反馈迭代 v2，改完升静态资源 `?v=N` 和 `sw.js` 的 `CACHE_NAME`。
5. 后续作品：② 学生主页生成器 → ③ 错题复习助手。
