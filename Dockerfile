FROM node
WORKDIR /agridirect/backend/
EXPOSE 3000
COPY . .
RUN npm install --legacy-peer-deps 

CMD ["node","index.js"]


