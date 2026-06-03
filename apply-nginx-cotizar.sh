#!/usr/bin/env bash
set -euo pipefail

SITE_NAME="cotizar.sistemasmecatronicos.com"
PROJECT_DIR="/home/saulordz/projects"
CONF_SRC="$PROJECT_DIR/nginx-cotizar.sistemasmecatronicos.com.conf"
CONF_DST="/etc/nginx/sites-available/$SITE_NAME.conf"
CONF_LINK="/etc/nginx/sites-enabled/$SITE_NAME.conf"

sudo cp "$CONF_SRC" "$CONF_DST"
sudo ln -sfn "$CONF_DST" "$CONF_LINK"
sudo nginx -t
sudo systemctl reload nginx

echo "Nginx virtual host enabled for https://$SITE_NAME"
