# 生产部署详细说明（含真实 SSO）

本文档用于指导你将当前项目部署到生产环境，并启用真实企业 SSO 登录。

适用目录结构：

- `backend/`：FastAPI 后端
- `frontend/`：React + Vite 前端

---

## 1. 部署目标与关键变化

生产环境与开发环境的核心差异：

1. 登录方式切换为真实 SSO
2. Mock 登录默认关闭
3. 数据库切换为 PostgreSQL
4. 前后端通过 Nginx + HTTPS 对外服务
5. 收紧 CORS、密钥与访问权限

---

## 2. 必备环境

服务器建议：

- Ubuntu 22.04+
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Nginx

域名建议：

- 前端：`https://your-domain.com`
- 后端 API：可与前端同域，通过 `/api` 反向代理到 FastAPI

---

## 3. SSO 对接前准备（必须先做）

你需要向公司身份平台（OIDC/OAuth2）申请以下信息：

- `client_id`
- `client_secret`
- 授权地址（Authorization URL）
- Token 地址（Token URL）
- UserInfo 地址（UserInfo URL）
- 回调地址白名单

本项目后端 SSO 回调地址应配置为：

`https://your-domain.com/api/v1/auth/callback/sso`

---

## 4. 后端配置（生产）

### 4.1 创建并启用虚拟环境

```bash
cd /opt/outbound/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4.2 配置 `.env`

在 `backend/.env` 中设置以下变量（示例）：

```env
PROJECT_NAME=员工外出交流信息登记系统
API_V1_STR=/api/v1

SECRET_KEY=请替换为高强度随机字符串
ACCESS_TOKEN_EXPIRE_MINUTES=10080

USE_SQLITE=False
POSTGRES_SERVER=127.0.0.1
POSTGRES_USER=outbound_user
POSTGRES_PASSWORD=请替换数据库密码
POSTGRES_DB=outbound_db

UPLOAD_DIR=/data/outbound/uploads
MAX_UPLOAD_SIZE=20971520

ENABLE_MOCK_SSO=False

SSO_CLIENT_ID=你的client_id
SSO_CLIENT_SECRET=你的client_secret
SSO_AUTHORIZATION_URL=https://sso.example.com/oauth2/authorize
SSO_TOKEN_URL=https://sso.example.com/oauth2/token
SSO_USERINFO_URL=https://sso.example.com/oauth2/userinfo
SSO_REDIRECT_URI=https://your-domain.com/api/v1/auth/callback/sso
SSO_SCOPE=openid profile email

SSO_USERINFO_EMPLOYEE_ID_FIELD=employee_id
SSO_USERINFO_NAME_FIELD=name
SSO_USERINFO_DEPARTMENT_FIELD=department

FRONTEND_SSO_CALLBACK_URL=https://your-domain.com/login
```

变量说明：

- `ENABLE_MOCK_SSO=False`：生产必须关闭 Mock 登录
- `SSO_REDIRECT_URI`：必须与 SSO 平台登记的回调地址完全一致
- `FRONTEND_SSO_CALLBACK_URL`：后端完成回调后跳回前端地址
- `SSO_USERINFO_*_FIELD`：如果企业 userinfo 字段名不同，需要改成实际字段

### 4.3 初始化数据库

```bash
cd /opt/outbound/backend
source venv/bin/activate
alembic upgrade head
```

### 4.4 启动后端（先手工验证）

```bash
cd /opt/outbound/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

## 5. 前端配置（生产）

### 5.1 安装与构建

```bash
cd /opt/outbound/frontend
npm ci
npm run build
```

构建产物输出在 `frontend/dist`。

### 5.2 前端环境变量建议

生产不建议暴露 Mock 入口，确保不要开启：

```env
VITE_ENABLE_MOCK_LOGIN=false
```

---

## 6. Nginx 配置（同域部署推荐）

示例 `/etc/nginx/sites-available/outbound`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /opt/outbound/frontend/dist;
    index index.html;

    client_max_body_size 25m;

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

启用：

```bash
sudo ln -s /etc/nginx/sites-available/outbound /etc/nginx/sites-enabled/outbound
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. systemd 托管后端

创建 `/etc/systemd/system/outbound-backend.service`：

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

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable outbound-backend
sudo systemctl start outbound-backend
sudo systemctl status outbound-backend
```

---

## 8. SSO 联调检查清单

按顺序检查：

1. 访问 `https://your-domain.com/login`
2. 点击“企业 SSO 登录”
3. 浏览器被重定向到公司 SSO 页面
4. 登录成功后回到 `/api/v1/auth/callback/sso`
5. 后端再重定向到 `https://your-domain.com/login?token=...`
6. 前端自动读取 token，登录成功并进入 dashboard

若失败，重点检查：

- `SSO_REDIRECT_URI` 与平台登记是否完全一致
- `FRONTEND_SSO_CALLBACK_URL` 是否可访问
- `SSO_USERINFO_*_FIELD` 字段映射是否与企业返回一致

---

## 9. 安全基线（上线前必须确认）

1. `ENABLE_MOCK_SSO=False`
2. 前端未暴露 Mock 登录入口（`VITE_ENABLE_MOCK_LOGIN=false`）
3. `SECRET_KEY` 为高强度随机值，且未写入代码仓库
4. CORS 白名单仅允许生产域名（不要 `*`）
5. 全站 HTTPS
6. 上传目录与代码目录隔离，目录权限最小化
7. PostgreSQL 开启备份与访问控制

---

## 10. 回滚与应急建议

建议保留两份可运行版本：

- 当前生产版本（N）
- 上一个稳定版本（N-1）

应急步骤：

1. `systemctl stop outbound-backend`
2. 切回 N-1 代码与对应前端构建产物
3. `alembic` 按迁移策略处理（如有破坏性迁移需提前设计）
4. `systemctl start outbound-backend`
5. 验证登录与核心业务链路

---

## 11. 最小上线验收清单

上线前至少完成以下验证：

1. 真实 SSO 登录成功（含回调）
2. 普通用户新建/编辑/删除自己的记录
3. 管理员锁定/解锁记录
4. 附件上传与下载可用
5. Excel 导出可用
6. 管理员审计日志可查看
7. 服务重启后功能正常

