#!/usr/bin/env bash
# Деплой quitter на gas2.
# Правило: код попадает на сервер ТОЛЬКО через git — сначала пуш в GitHub,
# затем git pull на сервере и сборка контейнеров из /opt/quitter.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n $(git status --porcelain) ]]; then
  echo "✗ Рабочее дерево грязное — сначала закоммить и запушь изменения." >&2
  exit 1
fi
git push origin main

ssh -A gas2 'set -e
cd /opt/quitter
git pull --ff-only
# Имя бота для клиентской сборки берём из env API (переменная BOT_USERNAME)
BOT_USERNAME=$(grep "^BOT_USERNAME=" /etc/quitter/api.env | cut -d= -f2 || true)
echo "→ Сборка образов…"
sudo docker build -q -t quitter-api ./api
sudo docker build -q --build-arg VITE_BOT_USERNAME="$BOT_USERNAME" \
  --build-arg VITE_API_BASE=/quit/api -t quitter-webapp ./miniapp
echo "→ Перезапуск контейнеров (blue-green: новый стартует до остановки старого)…"
sudo docker rm -f quitter-api-new quitter-app-new 2>/dev/null || true
sudo docker run -d --name quitter-api-new \
  --network community_default \
  -v /var/lib/quitter:/data \
  --env-file /etc/quitter/api.env \
  quitter-api
sudo docker run -d --name quitter-app-new \
  --network community_default \
  quitter-webapp
# ждём готовности нового API, затем мгновенная подмена имён (docker DNS)
for i in $(seq 1 20); do
  sudo docker exec community-proxy-1 wget -qO /dev/null http://quitter-api-new:8080/api/health 2>/dev/null && break
  sleep 1
done
sudo docker rm -f quitter-api quitter-app 2>/dev/null || true
sudo docker rename quitter-api-new quitter-api
sudo docker rename quitter-app-new quitter-app
sudo docker update --restart unless-stopped quitter-api quitter-app >/dev/null
# Grafana quitter: конфиги примонтированы из репозитория — перезапуск подхватывает
if sudo docker ps -a --format "{{.Names}}" | grep -q "^grafana-quitter$"; then
  sudo docker restart grafana-quitter >/dev/null
fi
sleep 3
sudo docker exec community-proxy-1 wget -qO- http://quitter-api:8080/api/health
echo
sudo docker exec community-proxy-1 wget -q --spider http://quitter-app:80/ && echo "webapp: ok"'

echo "✓ Деплой завершён"
