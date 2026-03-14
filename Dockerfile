FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install flask
RUN pip install flask flask-cors
EXPOSE 8080
CMD ["python", "cloud_auth_api.py"]
