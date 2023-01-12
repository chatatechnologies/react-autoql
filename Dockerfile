FROM node:14-alpine as build

# Create app directory

WORKDIR /app/react-autoql/

COPY package*.json .
COPY rollup.config.js .
COPY babel.config.js .
ADD src src
# clean install of the dependencies
RUN npm ci

# build widgets
RUN npm run build
# RUN ls -al 

# buid app
# COPY dist .
RUN ls -al 
WORKDIR /app
RUN ls -al 
ADD example .
RUN ls -al 
ENV NODE_ENV=ci
RUN npm i
RUN ls -al 

# Create a production build
RUN npm run build

RUN ls -al 

# FROM nginx:1.22.0-alpine

# COPY config/nginx_template.conf .
# COPY config/start_npm.sh .
# COPY --from=build /app/build /usr/share/nginx/html/

# RUN ls -al /usr/share/nginx/html/

# RUN chmod +x start_npm.sh
# ENTRYPOINT ["./start_npm.sh"]
