FROM node:10.15.3-alpine

# install python
# RUN apk --no-cache add g++ gcc libgcc libstdc++ linux-headers make python
# RUN npm install --quiet node-gyp -g

# Create app directory
WORKDIR /app

COPY ./package.json ./

RUN yarn
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY ./ .

CMD [ "node", "index.js" ]
