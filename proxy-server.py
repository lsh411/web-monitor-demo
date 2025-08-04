#!/usr/bin/env python3
"""
CORS 프록시 서버 - AWS API와 웹 클라이언트 간의 CORS 문제를 해결합니다.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json

API_BASE_URL = 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080'
PROXY_PORT = 3001

class CORSProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """OPTIONS 요청 처리 (CORS preflight)"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """GET 요청을 실제 API로 전달"""
        self.proxy_request()
    
    def do_POST(self):
        """POST 요청을 실제 API로 전달"""
        self.proxy_request()
    
    def send_cors_headers(self):
        """CORS 헤더 설정"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '3600')
    
    def proxy_request(self):
        """실제 API로 요청 전달"""
        try:
            # 실제 API URL 구성
            api_url = API_BASE_URL + self.path
            print(f"프록시 요청: {self.command} {api_url}")
            
            # 요청 생성
            req = urllib.request.Request(api_url, method=self.command)
            req.add_header('Content-Type', 'application/json')
            
            # 기존 헤더 복사 (Host 제외)
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    req.add_header(header, value)
            
            # POST 요청의 경우 body 데이터 처리
            body = None
            if self.command == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
            
            # 실제 API 호출
            try:
                with urllib.request.urlopen(req, data=body) as response:
                    # 응답 헤더 설정
                    self.send_response(response.getcode())
                    self.send_cors_headers()
                    
                    # 원본 응답 헤더 중 필요한 것만 전달
                    for header, value in response.headers.items():
                        if header.lower() not in ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']:
                            self.send_header(header, value)
                    
                    self.end_headers()
                    
                    # 응답 데이터 전달
                    self.wfile.write(response.read())
                    
            except urllib.error.HTTPError as e:
                print(f"API HTTP 에러: {e.code} - {e.reason}")
                # HTTP 에러도 CORS 헤더와 함께 전달
                self.send_response(e.code)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                error_body = e.read()
                if error_body:
                    self.wfile.write(error_body)
                else:
                    error_response = json.dumps({
                        'error': f'API returned {e.code}',
                        'message': str(e.reason)
                    })
                    self.wfile.write(error_response.encode())
                
        except Exception as e:
            print(f"프록시 에러: {type(e).__name__} - {e}")
            self.send_response(500)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({
                'error': 'Proxy server error',
                'message': str(e),
                'type': type(e).__name__
            })
            self.wfile.write(error_response.encode())
    
    def log_message(self, format, *args):
        """로그 메시지 포맷"""
        print(f"[{self.log_date_time_string()}] {format % args}")

def run_proxy_server():
    """프록시 서버 실행"""
    print(f"🚀 프록시 서버가 포트 {PROXY_PORT}에서 실행 중입니다.")
    print(f"📡 API 요청을 {API_BASE_URL}로 전달합니다.")
    print(f"\n사용법: http://localhost:{PROXY_PORT}를 API 엔드포인트로 사용하세요.")
    print("종료하려면 Ctrl+C를 누르세요.\n")
    
    server = HTTPServer(('', PROXY_PORT), CORSProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n프록시 서버를 종료합니다.")
        server.shutdown()

if __name__ == '__main__':
    run_proxy_server() 