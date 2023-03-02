#!/bin/sh
set -e

echo "SERVER_HOST is $SERVER_HOST."

# overwrite the PROXY_PASS url with the proper value
cat nginx_template.conf | sed "s#\${SERVER_HOST}#$SERVER_HOST#g" > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;'
