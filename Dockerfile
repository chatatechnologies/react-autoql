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
RUN npm i react@16.8.1 react-dom@16.8.1 -D
RUN npm run test

# final clean image
FROM nginx:1.22.0-alpine

COPY config/nginx_template.conf .
COPY config/start_npm.sh .
COPY --from=build /app/build /usr/share/nginx/html/

RUN chmod +x start_npm.sh
ENTRYPOINT ["./start_npm.sh"]
