$port = 8081
$settingsFile = Join-Path $PSScriptRoot "jira-settings.json"
$jiraBase = "https://kaltura.atlassian.net/rest/api/3"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  Jira proxy running at: http://localhost:$port/" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

function Get-JiraSettings {
    if (Test-Path $settingsFile) {
        try { return Get-Content $settingsFile -Raw | ConvertFrom-Json } catch {}
    }
    return $null
}

function Write-Response($res, $statusCode, $body) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.StatusCode = $statusCode
    $res.ContentType = "application/json; charset=utf-8"
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Accept")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        $path = $req.Url.LocalPath

        if ($path -eq "/health") {
            Write-Response $res 200 '{"ok":true}'
            continue
        }

        if ($req.HttpMethod -eq "POST" -and $path -eq "/settings") {
            $reader = New-Object System.IO.StreamReader($req.InputStream)
            $json = $reader.ReadToEnd()
            Set-Content $settingsFile $json -Encoding utf8
            Write-Response $res 200 '{"ok":true}'
            Write-Host "  Settings saved." -ForegroundColor Green
            continue
        }

        if ($path.StartsWith("/jira/")) {
            $s = Get-JiraSettings
            if (-not $s -or -not $s.jiraEmail -or -not $s.jiraToken) {
                Write-Response $res 401 '{"error":"No credentials. Configure in Settings."}'
                continue
            }

            $jiraPath = $path.Substring(6)
            $query = $req.Url.Query
            $jiraUrl = "$jiraBase/$jiraPath$query"
            $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))

            try {
                $wr = [System.Net.WebRequest]::Create($jiraUrl)
                $wr.Method = $req.HttpMethod
                $wr.Headers.Add("Authorization", "Basic $creds")
                $wr.Accept = "application/json"
                $wr.Timeout = 15000

                if ($req.HttpMethod -eq "PUT" -or $req.HttpMethod -eq "POST") {
                    $wr.ContentType = "application/json; charset=utf-8"
                    $reqBody = New-Object System.IO.StreamReader($req.InputStream)
                    $reqBodyStr = $reqBody.ReadToEnd()
                    $reqBytes = [System.Text.Encoding]::UTF8.GetBytes($reqBodyStr)
                    $wr.ContentLength = $reqBytes.Length
                    $wr.GetRequestStream().Write($reqBytes, 0, $reqBytes.Length)
                }

                $wresp = $wr.GetResponse()
                $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                $body = $sr.ReadToEnd()
                Write-Response $res ([int]$wresp.StatusCode) $body
                Write-Host "  OK  $jiraPath" -ForegroundColor Green
            } catch [System.Net.WebException] {
                $wresp = $_.Exception.Response
                if ($wresp) {
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    $body = $sr.ReadToEnd()
                    Write-Response $res ([int]$wresp.StatusCode) $body
                    Write-Host "  ERR $jiraPath $([int]$wresp.StatusCode)" -ForegroundColor Red
                } else {
                    Write-Response $res 502 "{`"error`":`"$($_.Exception.Message)`"}"
                    Write-Host "  ERR $jiraPath $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            continue
        }

        Write-Response $res 404 '{"error":"Not found"}'
    }
} finally {
    $listener.Stop()
}
