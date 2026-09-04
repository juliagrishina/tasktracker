[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$CardName,

  [Parameter(Mandatory)]
  [string]$TargetListName,

  [string]$BoardName = 'Task Tracker — Development',

  [AllowEmptyString()]
  [string]$Description
)

$ErrorActionPreference = 'Stop'

function Get-SafeHttpStatus {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)

  if ($ErrorRecord.Exception.Response) {
    return [int]$ErrorRecord.Exception.Response.StatusCode
  }

  return $null
}

function Stop-Safely {
  param([string]$Message, [System.Management.Automation.ErrorRecord]$ErrorRecord)

  $status = Get-SafeHttpStatus $ErrorRecord
  if ($null -ne $status) {
    throw "$Message (HTTP $status)."
  }

  throw $Message
}

function Get-SingleItem {
  param([object[]]$Items, [string]$Description)

  if (@($Items).Count -ne 1) {
    throw "$Description was not resolved uniquely."
  }

  return @($Items)[0]
}

try {
  $repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $envFile = Join-Path $repositoryRoot '.env'
  if (-not (Test-Path -LiteralPath $envFile)) {
    throw 'Local Trello configuration is unavailable.'
  }

  foreach ($line in (Get-Content -LiteralPath $envFile)) {
    if ($line -match '^\s*(TRELLO_API_KEY|TRELLO_TOKEN)\s*=\s*(.+?)\s*$') {
      Set-Item -Path ('Env:' + $matches[1]) -Value $matches[2].Trim('"').Trim("'")
    }
  }

  if (-not $env:TRELLO_API_KEY -or -not $env:TRELLO_TOKEN) {
    throw 'Local Trello configuration is incomplete.'
  }

  $auth = 'key=' + [uri]::EscapeDataString($env:TRELLO_API_KEY) + '&token=' + [uri]::EscapeDataString($env:TRELLO_TOKEN)
  $apiRoot = 'https://api.trello.com/1/'

  function Invoke-TrelloJson {
    param([string]$Method, [string]$Path, [object]$Body)

    $separator = if ($Path.Contains('?')) { '&' } else { '?' }
    $uri = $apiRoot + $Path + $separator + $auth
    if ($PSBoundParameters.ContainsKey('Body')) {
      $json = $Body | ConvertTo-Json -Compress -Depth 8
      return Invoke-RestMethod -Method $Method -Uri $uri -ContentType 'application/json' -Body $json
    }

    return Invoke-RestMethod -Method $Method -Uri $uri
  }

  $boards = Invoke-TrelloJson -Method Get -Path 'members/me/boards?fields=id,name&'
  $board = Get-SingleItem @($boards | Where-Object { $_.name -eq $BoardName }) 'Target board'
  $lists = Invoke-TrelloJson -Method Get -Path ('boards/' + $board.id + '/lists?fields=id,name&filter=open&')
  $targetList = Get-SingleItem @($lists | Where-Object { $_.name -eq $TargetListName }) 'Target list'
  $cards = Invoke-TrelloJson -Method Get -Path ('boards/' + $board.id + '/cards?fields=id,name,idList,desc&filter=open&')
  $card = Get-SingleItem @($cards | Where-Object { $_.name -eq $CardName }) 'Target card'
  # Trello silently ignores form-encoded body values for some card updates. Always send JSON.
  $null = Invoke-TrelloJson -Method Put -Path ('cards/' + $card.id) -Body @{ idList = $targetList.id }
  $storedCard = Invoke-TrelloJson -Method Get -Path ('cards/' + $card.id + '?fields=idList,desc,name&')
  if ($storedCard.idList -ne $targetList.id) {
    throw "Read-back failed for transition to '$TargetListName'."
  }

  if ($PSBoundParameters.ContainsKey('Description')) {
    $null = Invoke-TrelloJson -Method Put -Path ('cards/' + $card.id) -Body @{ desc = $Description }
    $storedCard = Invoke-TrelloJson -Method Get -Path ('cards/' + $card.id + '?fields=idList,desc,name&')
    if ($storedCard.desc -ne $Description) {
      throw 'Read-back failed for the card description.'
    }
  }

  Write-Output 'Trello update and read-back: HTTP 200'
  Write-Output ('Card: ' + $storedCard.name)
  Write-Output ('List: ' + $TargetListName)
  if ($PSBoundParameters.ContainsKey('Description')) {
    Write-Output 'Description: saved'
  }
} catch {
  Stop-Safely -Message 'Trello update failed' -ErrorRecord $_
}
