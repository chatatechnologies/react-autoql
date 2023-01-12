FROM node:14-alpine as build

# Create app directory

WORKDIR /app

COPY package*.json .
COPY rollup.config.js .
COPY babel.config.js .
# clean install of the dependencies
RUN npm ci

ADD src src
RUN npm run build

# COPY dist .

# WORKDIR /app

# ADD example .

# ENV NODE_ENV=ci

# RUN npm i

# # Create a production build
# RUN npm run build
ls -al 

FROM nginx:1.22.0-alpine

COPY config/nginx_template.conf .
COPY config/start_npm.sh .
COPY --from=build /app/dist /usr/share/nginx/html/

RUN chmod +x start_npm.sh
ENTRYPOINT ["./start_npm.sh"]
