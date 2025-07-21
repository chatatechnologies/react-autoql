FROM node:16-alpine as build

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

RUN npm i file:./react-autoql
RUN npm i --legacy-peer-deps && npm run build

# final clean image
FROM nginx:1.22.0-alpine

COPY config/nginx_template.conf .
COPY config/start_npm.sh .
COPY --from=build /app/build /usr/share/nginx/html/

RUN chmod +x start_npm.sh
ENTRYPOINT ["./start_npm.sh"]
