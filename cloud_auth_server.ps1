$port = 8890
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

function WriteJson($ctx, $code, $obj) {
  $r = $ctx.Response
  $r.ContentType = 'application/json'
  $r.StatusCode = $code
  $b = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $r.ContentLength64 = $b.Length
  $r.OutputStream.Write($b, 0, $b.Length)
  $r.OutputStream.Close()
}

function WriteText($ctx, $code, $txt) {
  $r = $ctx.Response
  $r.ContentType = 'text/plain'
  $r.StatusCode = $code
  $b = [System.Text.Encoding]::UTF8.GetBytes($txt)
  $r.ContentLength64 = $b.Length
  $r.OutputStream.Write($b, 0, $b.Length)
  $r.OutputStream.Close()
}

$credsFile = Join-Path $PSScriptRoot 'credentials.json'
if (-not (Test-Path $credsFile)) {
  @{ email = 'admin@proton.io'; passwordHash = '0e6ae23677aafbd39f3d029b8b1a9377b6056eed26ad567e561919038a9b7fee'; licenseKey = 'PROTON-KEY-1234' } | ConvertTo-Json -Compress | Set-Content -Path $credsFile -Encoding UTF8
}
$creds = Get-Content -Raw -Path $credsFile | ConvertFrom-Json
if (-not $creds.email -or -not $creds.passwordHash -or -not $creds.licenseKey) { Write-Host 'Invalid credentials file'; exit 1 }

try {
  $listener.Start()
} catch {
  Write-Host "Cannot start listener: $_"
  exit 1
}

Write-Host "Auth server running at http://127.0.0.1:$port/"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }

  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers.Add('Access-Control-Allow-Origin', '*')
  $res.Headers.Add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

  if ($req.HttpMethod -eq 'OPTIONS') {
    $res.StatusCode = 204
    $res.OutputStream.Close()
    continue
  }

  if ($req.Url.AbsolutePath -eq '/status' -and $req.HttpMethod -eq 'GET') {
    WriteJson $ctx 200 @{ success = $true; status = 'online' }
    continue
  }

  if ($req.Url.AbsolutePath -eq '/auth' -and $req.HttpMethod -eq 'POST') {
    try {
      $body = (New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)).ReadToEnd()
      $obj = $body | ConvertFrom-Json
            if (-not $obj.email -or -not $obj.passwordHash -or -not $obj.licenseKey) {
        WriteJson $ctx 400 @{ success = $false; message = 'Missing email, passwordHash or licenseKey.' }
        continue
      }
      if ($obj.email -eq $creds.email -and $obj.passwordHash -eq $creds.passwordHash -and $obj.licenseKey -eq $creds.licenseKey) {
        WriteJson $ctx 200 @{ success = $true; message = 'Authenticated' }
        continue
      }
      WriteJson $ctx 401 @{ success = $false; message = 'Invalid email, password, or license key.' }
      continue
    } catch {
      WriteJson $ctx 500 @{ success = $false; message = 'Invalid request payload.' }
      continue
    }
  }

  WriteText $ctx 404 'Not found'
}
