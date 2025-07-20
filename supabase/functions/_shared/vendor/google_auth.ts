// This is a vendored (local copy) of a JWT-based Google Auth implementation
// to ensure reliable deployment on Deno Deploy.

export class GoogleAuth {
    constructor(private options: { credentials: { client_email: string; private_key: string }; scopes: string[] }) {}
  
    async getAccessToken() {
      if (!this.options.credentials) {
        throw new Error("Credentials are not defined");
      }
      const { client_email, private_key } = this.options.credentials;
      const scopes = this.options.scopes || [];
  
      const header = {
        alg: "RS256",
        typ: "JWT",
      };
  
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: client_email,
        sub: client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: scopes.join(" "),
      };
  
      const textEncoder = new TextEncoder();
      const sign = async (data: Uint8Array, keyString: string) => {
        // Robust PEM key parsing
        const pemContents = keyString.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
        
        // Convert PEM to DER
        const binaryDer = atob(pemContents);
        const buffer = new Uint8Array(binaryDer.length);
        for (let i = 0; i < binaryDer.length; i++) {
          buffer[i] = binaryDer.charCodeAt(i);
        }
        
        const key = await crypto.subtle.importKey(
          "pkcs8",
          buffer,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["sign"]
        );
        return crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
      };
  
      const b64UrlEncode = (data: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(data))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      
      const headerB64 = b64UrlEncode(textEncoder.encode(JSON.stringify(header)));
      const payloadB64 = b64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
      const dataToSign = textEncoder.encode(`${headerB64}.${payloadB64}`);
      
      const signature = await sign(dataToSign, private_key);
  
      const jwt = `${headerB64}.${payloadB64}.${b64UrlEncode(signature)}`;
  
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Failed to fetch access token: ${res.status} ${errorBody}`);
      }
  
      const { access_token } = await res.json();
      return access_token;
    }
  } 