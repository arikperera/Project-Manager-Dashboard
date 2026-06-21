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

$script:sfTokenCache = $null

function Get-SFSettings {
    $sfFile = Join-Path $PSScriptRoot "sf-settings.json"
    if (Test-Path $sfFile) {
        try { return Get-Content $sfFile -Raw | ConvertFrom-Json } catch {}
    }
    return $null
}

function Get-SFAccessToken {
    if ($script:sfTokenCache -and $script:sfTokenCache.expiresAt -gt (Get-Date)) {
        return $script:sfTokenCache
    }
    $s = Get-SFSettings
    if (-not $s -or -not $s.sfUsername) { throw "SF credentials not configured" }

    $body = "grant_type=password" +
            "&client_id=$([Uri]::EscapeDataString($s.sfClientId))" +
            "&client_secret=$([Uri]::EscapeDataString($s.sfClientSecret))" +
            "&username=$([Uri]::EscapeDataString($s.sfUsername))" +
            "&password=$([Uri]::EscapeDataString($s.sfPasswordWithToken))"

    $wr = [System.Net.WebRequest]::Create("https://login.salesforce.com/services/oauth2/token")
    $wr.Method = "POST"
    $wr.ContentType = "application/x-www-form-urlencoded"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $wr.ContentLength = $bodyBytes.Length
    $wr.GetRequestStream().Write($bodyBytes, 0, $bodyBytes.Length)

    $wresp = $wr.GetResponse()
    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
    $tokenJson = $sr.ReadToEnd() | ConvertFrom-Json

    $script:sfTokenCache = @{
        accessToken = $tokenJson.access_token
        instanceUrl = $tokenJson.instance_url
        expiresAt   = (Get-Date).AddMinutes(110)
    }
    return $script:sfTokenCache
}

function Invoke-SFRequest($instanceUrl, $accessToken, $path) {
    $url = "$instanceUrl$path"
    $wr = [System.Net.WebRequest]::Create($url)
    $wr.Method = "GET"
    $wr.Headers.Add("Authorization", "Bearer $accessToken")
    $wr.Accept = "application/json"
    $wr.Timeout = 45000
    $wresp = $wr.GetResponse()
    try {
        $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
        $body = $sr.ReadToEnd()
        $sr.Close()
        return $body | ConvertFrom-Json
    } finally {
        $wresp.Close()
    }
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

        if ($req.HttpMethod -eq "POST" -and $path -eq "/settings/sf") {
            $sfSettingsFile = Join-Path $PSScriptRoot "sf-settings.json"
            $reader = New-Object System.IO.StreamReader($req.InputStream)
            $json = $reader.ReadToEnd()
            Set-Content $sfSettingsFile $json -Encoding utf8
            Write-Response $res 200 '{"ok":true}'
            Write-Host "  SF settings saved." -ForegroundColor Green
            continue
        }

        if ($req.HttpMethod -eq "GET" -and $path -eq "/jira/new-assignments") {
            $s = Get-JiraSettings
            if (-not $s -or -not $s.jiraEmail -or -not $s.jiraToken) {
                Write-Response $res 401 '{"error":"No Jira credentials configured."}'
                continue
            }
            $watched = $s.watchedAssignees
            if (-not $watched -or $watched.Count -eq 0) {
                Write-Response $res 200 '[]'
                continue
            }
            $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
            $allIssues = [System.Collections.Generic.List[object]]::new()
            foreach ($email in $watched) {
                $jql = [Uri]::EscapeDataString("assignee=`"$email`" AND project=PSVAMB AND created>=-30d ORDER BY created DESC")
                $jiraUrl = "https://kaltura.atlassian.net/rest/api/3/search?jql=$jql&fields=summary,assignee,created,status&maxResults=50"
                try {
                    $wr = [System.Net.WebRequest]::Create($jiraUrl)
                    $wr.Method = "GET"
                    $wr.Headers.Add("Authorization", "Basic $creds")
                    $wr.Accept = "application/json"
                    $wr.Timeout = 45000
                    $wresp = $wr.GetResponse()
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    $data = $sr.ReadToEnd() | ConvertFrom-Json
                    $sr.Close()
                    $wresp.Close()
                    foreach ($issue in $data.issues) {
                        $allIssues.Add(@{
                            key                = $issue.key
                            summary            = $issue.fields.summary
                            assigneeEmail      = $issue.fields.assignee.emailAddress
                            assigneeDisplayName = $issue.fields.assignee.displayName
                            created            = $issue.fields.created
                            jiraUrl            = "https://kaltura.atlassian.net/browse/$($issue.key)"
                        })
                    }
                } catch {
                    Write-Host "  ERR new-assignments for $email $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            $json = $allIssues | ConvertTo-Json -Compress -Depth 5
            if ($allIssues.Count -eq 1) { $json = "[$json]" }
            if ($allIssues.Count -eq 0) { $json = "[]" }
            Write-Response $res 200 $json
            Write-Host "  OK  /jira/new-assignments ($($allIssues.Count) issues)" -ForegroundColor Green
            continue
        }

        if ($req.HttpMethod -eq "GET" -and $path -eq "/sf/enrich") {
            $sfSettings = Get-SFSettings
            if (-not $sfSettings -or -not $sfSettings.sfUsername) {
                Write-Response $res 200 '{"sfSkipped":true}'
                continue
            }
            $jiraKey = $req.QueryString["jiraKey"]
            if (-not $jiraKey) {
                Write-Response $res 400 '{"error":"jiraKey required"}'
                continue
            }
            try {
                # Step 1: Fetch Jira issue to get SF Opportunity ID from remote links
                $s = Get-JiraSettings
                $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
                $wr = [System.Net.WebRequest]::Create("https://kaltura.atlassian.net/rest/api/3/issue/$jiraKey/remotelink")
                $wr.Method = "GET"
                $wr.Headers.Add("Authorization", "Basic $creds")
                $wr.Accept = "application/json"
                $wr.Timeout = 45000
                $wresp = $wr.GetResponse()
                $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                $remoteLinks = $sr.ReadToEnd() | ConvertFrom-Json
                $sr.Close()
                $wresp.Close()
                $sfLink = $remoteLinks | Where-Object { $_.object.url -like "*lightning.force.com*" } | Select-Object -First 1
                if (-not $sfLink) {
                    Write-Response $res 200 '{"sfError":"No SF link found on Jira issue"}'
                    continue
                }
                $sfUrl = $sfLink.object.url
                # Extract Opportunity ID from URL: .../Opportunity/006TQ00000daFmrYAE/view
                $oppId = ($sfUrl -split "/Opportunity/")[1] -split "/" | Select-Object -First 1

                # Step 2: Get SF token and fetch Opportunity
                $token = Get-SFAccessToken
                $opp = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/Opportunity/$($oppId)?fields=Name,Total_PS_Hours__c,Amount,Kaltura_NRR__c,AccountId"
                $accountId = $opp.AccountId

                # Step 3: Fetch SF Account
                $acct = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/Account/$($accountId)?fields=Name,OwnerId,Customer_Success_Manager__c"

                # Step 4: Resolve Account Owner (Sales) name
                $salesName = ""
                if ($acct.OwnerId) {
                    try {
                        $owner = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/User/$($acct.OwnerId)?fields=Name"
                        $salesName = $owner.Name
                    } catch { $salesName = "" }
                }

                # Step 5: Resolve CSM name — field may be a lookup (ID) or text
                $csmName = ""
                if ($acct.Customer_Success_Manager__c) {
                    $csmRaw = $acct.Customer_Success_Manager__c
                    if ($csmRaw -match "^[0-9a-zA-Z]{15,18}$") {
                        try {
                            $csm = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/User/$csmRaw?fields=Name"
                            $csmName = $csm.Name
                        } catch { $csmName = $csmRaw }
                    } else {
                        $csmName = $csmRaw
                    }
                }

                $oppUrl = "https://kaltura.lightning.force.com/lightning/r/Opportunity/$oppId/view"
                $result = @{
                    customer  = $acct.Name
                    name      = $opp.Name
                    nrrHours  = $opp.Total_PS_Hours__c
                    mrr       = $opp.Amount
                    nrr       = $opp.Kaltura_NRR__c
                    oppUrl    = $oppUrl
                    salesName = $salesName
                    csmName   = $csmName
                }
                Write-Response $res 200 ($result | ConvertTo-Json -Compress)
                Write-Host "  OK  /sf/enrich $jiraKey" -ForegroundColor Green
            } catch {
                # If token expired mid-request, clear cache and let next poll retry
                $script:sfTokenCache = $null
                $errJson = @{ sfError = $_.Exception.Message } | ConvertTo-Json -Compress
                Write-Response $res 200 $errJson
                Write-Host "  ERR /sf/enrich $jiraKey $($_.Exception.Message)" -ForegroundColor Red
            }
            continue
        }

        if ($req.HttpMethod -eq "GET" -and $path -eq "/jira/field") {
            $s = Get-JiraSettings
            if (-not $s -or -not $s.jiraEmail -or -not $s.jiraToken) {
                Write-Response $res 401 '{"error":"No credentials."}'
                continue
            }
            $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
            try {
                $wr = [System.Net.WebRequest]::Create("https://kaltura.atlassian.net/rest/api/3/field")
                $wr.Method = "GET"
                $wr.Headers.Add("Authorization", "Basic $creds")
                $wr.Accept = "application/json"
                $wr.Timeout = 45000
                $wresp = $wr.GetResponse()
                $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                $body = $sr.ReadToEnd()
                $sr.Close(); $wresp.Close()
                Write-Response $res 200 $body
                Write-Host "  OK  /jira/field" -ForegroundColor Green
            } catch [System.Net.WebException] {
                $wresp = $_.Exception.Response
                if ($wresp) {
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    Write-Response $res ([int]$wresp.StatusCode) ($sr.ReadToEnd())
                } else {
                    Write-Response $res 502 "{`"error`":`"$($_.Exception.Message)`"}"
                }
                Write-Host "  ERR /jira/field $($_.Exception.Message)" -ForegroundColor Red
            }
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
                $wr.Timeout = 45000

                if ($req.HttpMethod -eq "PUT" -or $req.HttpMethod -eq "POST") {
                    $wr.ContentType = "application/json; charset=utf-8"
                    $reqBody = New-Object System.IO.StreamReader($req.InputStream)
                    $reqBodyStr = $reqBody.ReadToEnd()
                    $reqBody.Close()
                    $reqBytes = [System.Text.Encoding]::UTF8.GetBytes($reqBodyStr)
                    $wr.ContentLength = $reqBytes.Length
                    $reqStream = $wr.GetRequestStream()
                    $reqStream.Write($reqBytes, 0, $reqBytes.Length)
                    $reqStream.Close()
                }

                $wresp = $wr.GetResponse()
                try {
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    $body = $sr.ReadToEnd()
                    $sr.Close()
                } finally {
                    $wresp.Close()
                }
                Write-Response $res ([int]$wresp.StatusCode) $body
                Write-Host "  OK  $jiraPath" -ForegroundColor Green
            } catch [System.Net.WebException] {
                $wresp = $_.Exception.Response
                if ($wresp) {
                    try {
                        $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                        $body = $sr.ReadToEnd()
                        $sr.Close()
                    } finally {
                        $wresp.Close()
                    }
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
