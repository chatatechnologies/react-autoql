FROM us-east1-docker.pkg.dev/staging-245514/docker-hub/node:24.22.1-alpine as build

# Create app directory

WORKDIR /app/react-autoql/

COPY package*.json .
COPY rollup.config.js .
COPY babel.config.js .
ADD src src

# clean install of the dependencies and 
# build widgets
RUN npm ci --legacy-peer-deps && npm run build 

# buid example app
WORKDIR /app
ADD example .
ENV NODE_ENV=ci
ENV NODE_OPTIONS=--openssl-legacy-provider

# --legacy-peer-deps, as the install below has: without it npm has crashed here on every branch since 15 Oct 2026
# ("Cannot read properties of null (reading 'edgesOut')"). If it fails anyway, the end of npm's debug log, with the
# stack, goes to the build log.
RUN npm i --legacy-peer-deps file:./react-autoql || (tail -n 80 /root/.npm/_logs/*-debug-0.log; exit 1)
RUN npm i --legacy-peer-deps && npm run build

# final clean image
FROM nginx:1.22.0-alpine

COPY config/nginx_template.conf .
COPY config/start_npm.sh .
COPY --from=build /app/build /usr/share/nginx/html/

RUN chmod +x start_npm.sh
ENTRYPOINT ["./start_npm.sh"]
