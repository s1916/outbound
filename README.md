# 员工外出交流信息登记系统

一个基于 **FastAPI + React + TypeScript** 的前后端分离系统，用于登记和管理员工外出交流信息，支持角色权限控制、附件上传、筛选检索、审计追踪和 Excel 导出。

## 1. 功能概览

### 1.1 核心业务能力
- 交流记录新增、编辑、软删除
- 附件上传与下载（JPG/PNG/PDF，最大 20MB）
- 记录锁定/解锁（管理员）
- 审计日志查看（管理员）
- Excel 导出（按勾选记录导出）

### 1.2 参与人能力
- 动态增删参与人输入行（每人一个输入格）
- 支持“本公司 / 对方公司”参与人类型切换
- 本公司参与人支持输入联想检索：
  - 输入姓名片段或工号片段可出现候选项
  - 点击候选项自动回填工号

### 1.3 检索筛选能力
- 客户名称
- 城市
- 提交人（姓名/工号）
- 锁定状态（全部、可编辑、已锁定）
- 交流日期区间（开始日期、结束日期）

### 1.4 鉴权与权限
- JWT 鉴权
- RBAC：
  - 普通用户：仅可操作自己的记录
  - 管理员：可查看全量数据、锁定/解锁、查看审计
- 开发环境支持 Mock SSO 登录

## 2. 技术栈

### 前端
- React 19 + TypeScript + Vite
- React Router
- React Hook Form
- Tailwind CSS v4
- Axios

### 后端
- FastAPI
- SQLAlchemy + Alembic
- Pydantic Settings
- Python-JOSE (JWT)
- Pandas + Openpyxl（Excel 导出）

### 数据库
- 开发：SQLite（默认）
- 生产：PostgreSQL（推荐）

## 3. 目录结构

```text
outbound/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/     # auth、records、admin、files、export
│   │   ├── core/              # 配置、安全
│   │   ├── db/                # 会话与基类
│   │   ├── models/            # SQLAlchemy 模型
│   │   └── schemas/           # Pydantic 模型
│   ├── alembic/               # 迁移脚本
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── context/           # AuthContext
    │   ├── layouts/           # 主布局
    │   ├── pages/             # Login、RecordList、RecordForm、AdminLogs...
    │   └── services/          # Axios 封装
    ├── package.json
    └── vite.config.ts
```

## 4. 本地开发部署（快速开始）

### 4.1 环境要求
- Python 3.9+
- Node.js 18+

### 4.2 后端启动

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

后端文档地址：`http://127.0.0.1:8000/docs`

### 4.3 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端地址：`http://localhost:5173`

## 5. 使用教程

### 5.1 登录
- 开发环境 Mock SSO：
  - 输入 `admin`：管理员
  - 输入任意工号（例如 `1001`）：普通用户

### 5.2 新建记录
1. 进入“新建申请”
2. 填写客户、城市、日期
3. 在“参与人员”中按需添加行：
   - 选择“本公司”时，可输入姓名/工号触发联想并点选
   - 选择“对方公司”时，直接输入姓名
4. 上传附件（可选）
5. 点击保存

### 5.3 记录管理
- 使用筛选区域按条件查询
- 支持多选记录并“导出所选”
- 管理员可锁定/解锁记录

### 5.4 管理员审计
- 管理员进入“审计日志”查看操作历史

## 6. 测试与验证

### 6.1 前端静态检查与构建

```bash
cd frontend
npm run lint
npm run build
```

### 6.2 后端测试

```bash
cd backend
source venv/bin/activate
pytest
```

说明：当前仓库 pytest 用例尚未补齐，命令可执行但可能显示 `collected 0 items`。

### 6.3 手工测试建议路径
1. 普通用户登录 -> 新建记录 -> 编辑/删除自己的记录
2. 管理员登录 -> 锁定普通用户记录 -> 普通用户验证不可编辑
3. 列表筛选 + 勾选导出 -> 校验 Excel 内容
4. 本公司参与人联想检索（姓名/工号）-> 点击候选项回填

## 7. 生产部署教程（推荐方案）

以下以 **Ubuntu + Nginx + systemd + PostgreSQL** 为例。

### 7.1 准备服务器
- 安装 Python、Node.js、Nginx、PostgreSQL
- 拉取项目代码到服务器目录（如 `/opt/outbound`）

### 7.2 配置后端

```bash
cd /opt/outbound/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

修改 `backend/.env`（关键项）：

```env
USE_SQLITE=False
POSTGRES_SERVER=127.0.0.1
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=employee_exchange_db
SECRET_KEY=replace-with-strong-random-secret
```

执行迁移：

```bash
cd /opt/outbound/backend
source venv/bin/activate
alembic upgrade head
```

### 7.3 配置前端

```bash
cd /opt/outbound/frontend
npm ci
npm run build
```

构建产物在 `frontend/dist`。

### 7.4 使用 systemd 托管后端

示例服务文件 `/etc/systemd/system/outbound-backend.service`：

```ini
[Unit]
Description=Outbound Backend FastAPI
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/outbound/backend
Environment="PATH=/opt/outbound/backend/venv/bin"
ExecStart=/opt/outbound/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable outbound-backend
sudo systemctl start outbound-backend
sudo systemctl status outbound-backend
```

### 7.5 配置 Nginx

示例 `/etc/nginx/sites-available/outbound`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /opt/outbound/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/outbound /etc/nginx/sites-enabled/outbound
sudo nginx -t
sudo systemctl reload nginx
```

### 7.6 HTTPS（建议）
- 生产环境建议配合 Let’s Encrypt（certbot）开启 HTTPS
- 启用后将 `server_name` 与证书路径配置到 Nginx

## 8. SSO 对接说明（从 Mock 迁移到企业 SSO）

当前登录接口为开发模拟实现。对接企业 SSO 时建议：
1. 在 `auth` 模块中替换 Mock 登录逻辑
2. 使用 Authlib 对接 OAuth2 / OIDC / SAML（按企业规范）
3. 完成回调后映射企业账号到本地用户
4. 保留 JWT 与 RBAC 作为系统内权限控制层

## 9. 环境变量说明（后端）

- `PROJECT_NAME`：项目名
- `API_V1_STR`：API 前缀
- `SECRET_KEY`：JWT 签名密钥（生产必须强随机）
- `ACCESS_TOKEN_EXPIRE_MINUTES`：Token 过期时间
- `USE_SQLITE`：开发可用，生产建议 `False`
- `POSTGRES_SERVER / USER / PASSWORD / DB`：PostgreSQL 配置
- `UPLOAD_DIR`：附件目录
- `MAX_UPLOAD_SIZE`：附件大小限制（字节）

## 10. 常见问题

### 10.1 登录后提示 Not authenticated
- 检查前后端是否同时运行
- 检查浏览器是否禁用了 localStorage
- 清空浏览器 token 后重新登录

### 10.2 本公司参与人联想无结果
- 该用户必须存在于 `users` 表（登录过一次会自动创建）
- 确认输入的是姓名片段或工号片段

### 10.3 导出 Excel 为空
- 需要先勾选记录再点击导出
- 普通用户只能导出自己有权限查看的记录

## 11. 开源与合规

本项目使用的核心技术均为开源方案，可用于企业内部系统开发。上线前请结合公司合规要求完成依赖许可证审查与安全评估。
