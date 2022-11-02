FROM tarampampam/node:14-alpine

WORKDIR /app

COPY . .

RUN git checkout

RUN npm ci
RUN npm i react@16.14.0 react-dom@16.14.0 -D

# Run tests
RUN npm run test

# Publish to npm (remove --dry-run when this is ready for production)
# This requires NPM_TOKEN and GH_TOKEN environment variables
RUN npx semantic-release --dry-run