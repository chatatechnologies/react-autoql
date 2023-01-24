FROM node:14-alpine as build

WORKDIR /app/react-autoql/

COPY package*.json .
COPY rollup.config.js .
COPY babel.config.js .
ADD src src

RUN npm ci
RUN npm run build

COPY dist .

WORKDIR /app

ADD example .

ENV NODE_ENV=ci

RUN npm i --unsafe-perm

# Create a production build
RUN npm run build

FROM nginx:1.22.0-alpine

COPY config/nginx_template.conf .
COPY config/start_npm.sh .
COPY --from=build //app/build /usr/share/nginx/html/

RUN chmod +x start_npm.sh
ENTRYPOINT ["./start_npm.sh"]
