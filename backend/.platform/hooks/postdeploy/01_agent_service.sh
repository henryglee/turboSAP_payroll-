cat >/etc/systemd/system/agent.service <<'EOF'
[Unit]
Description=Agent service (localhost:4096)
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/app/current

ExecStart=/var/app/current/uploads/opencode-linux-x64/bin/opencode serve --port 4096

Restart=always
RestartSec=2
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable agent.service
systemctl restart agent.service
systemctl status agent.service --no-pager || true
