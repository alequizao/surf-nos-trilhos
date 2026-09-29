<?php
/* Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados. */
// Ranking online. Arquivo idêntico em cada jogo — só muda a constante JOGO.
// GET  ranking.php[?nome=X]  -> { ok, jogo, top:[{pos,nome,pontos,moedas,dist,data}], voce:{pos,pontos}|null }
// POST ranking.php (JSON ou form: nome, pontos, moedas, dist) -> { ok, pos, pontos, melhorou } | { ok:false, erro }
const JOGO = 'surf';
const PASTA_DADOS = '/www/wwwroot/alequizao.com/_dados';
const LIMITE_ENVIOS = 10;      // por IP...
const JANELA_SEG = 600;        // ...a cada 10 min
const TOP = 50;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('CDN-Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function sai($dados, $cod = 200) { http_response_code($cod); echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro($msg, $cod = 400) { sai(['ok' => false, 'erro' => $msg], $cod); }

function banco() {
  if (!is_dir(PASTA_DADOS)) @mkdir(PASTA_DADOS, 0750, true);
  $db = new PDO('sqlite:' . PASTA_DADOS . '/ranking.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  $db->exec('PRAGMA busy_timeout = 4000');
  $db->exec('PRAGMA journal_mode = WAL');
  $db->exec('CREATE TABLE IF NOT EXISTS ranking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jogo TEXT NOT NULL, nome TEXT NOT NULL, chave TEXT NOT NULL,
    pontos INTEGER NOT NULL, moedas INTEGER NOT NULL, dist INTEGER NOT NULL,
    data TEXT NOT NULL, ip_hash TEXT NOT NULL,
    UNIQUE(jogo, chave))');
  $db->exec('CREATE INDEX IF NOT EXISTS ix_ranking_pontos ON ranking(jogo, pontos DESC)');
  $db->exec('CREATE TABLE IF NOT EXISTS envios (ip_hash TEXT NOT NULL, ts INTEGER NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS ix_envios ON envios(ip_hash, ts)');
  return $db;
}

function ipHash() {
  $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '0');
  $arq = PASTA_DADOS . '/segredo.txt';
  $sal = @file_get_contents($arq);
  if (!$sal) { $sal = bin2hex(random_bytes(24)); @file_put_contents($arq, $sal); @chmod($arq, 0640); }
  return substr(hash_hmac('sha256', $ip, $sal), 0, 32);
}

// normaliza para comparar nomes e procurar palavrões (sem acento, minúsculo, leet speak)
function normaliza($s) {
  $s = mb_strtolower($s, 'UTF-8');
  $s = strtr($s, ['á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','é'=>'e','ê'=>'e','è'=>'e','í'=>'i','ì'=>'i','î'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ò'=>'o','ö'=>'o','ú'=>'u','ù'=>'u','ü'=>'u','ç'=>'c','ñ'=>'n']);
  return strtr($s, ['0'=>'o','1'=>'i','3'=>'e','4'=>'a','5'=>'s','7'=>'t','8'=>'b','$'=>'s','!'=>'i']);
}
function palavrao($nome) {
  $n = normaliza($nome);
  $junto = preg_replace('/[^a-z]/', '', $n);            // "p.u.t.a" -> "puta"
  $colado = preg_replace('/(.)\1+/', '$1', $junto);       // "puuuta" -> "puta"
  // trechos que nunca aparecem em nome decente (busca dentro do texto todo)
  $dentro = ['porra','caralh','buceta','bucet','xoxota','xereca','puta','putinh','viad','fdp','filhodaput','arrombad','corno','cuzao','cuza','merda','bost','piroc','pica','punhet',
    'siriric','foder','fode','fudid','foda','boquet','kct','cacete','vagabund','vadia','piranha','rapariga','escrot','babac','otari','retardad','macac','nazi','hitler','estupr',
    'pedofil','nigg','fuck','shit','bitch','cunt','dick','pussy','whore','slut','penis','vagin','anus','xvideo','pornh','porno','sexo','bct','pqp','vsf','vtnc','tnc','krl'];
  foreach ($dentro as $p) if (strpos($junto, $p) !== false || strpos($colado, $p) !== false) return true;
  // palavras curtas: só como palavra inteira
  $inteiras = ['cu','cus','pau','rola','pinto','bunda','xana','xota','bixa','bicha','cuck','ass','sex','nude','nudes'];
  foreach (preg_split('/[^a-z]+/', $n, -1, PREG_SPLIT_NO_EMPTY) as $w) if (in_array($w, $inteiras, true)) return true;
  return false;
}

function limpaNome($bruto) {
  $s = (string)$bruto;
  if (!mb_check_encoding($s, 'UTF-8')) return [null, 'Nome inválido.'];
  $s = html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $s = strip_tags($s);
  $s = preg_replace('/[\p{C}<>"\'`\\\\{}]/u', '', $s);  // controle, invisíveis e caracteres de HTML
  $s = trim(preg_replace('/\s+/u', ' ', $s));
  if ($s !== '' && $s[0] === '@') {
    $s = '@' . ltrim(substr($s, 1));
    if (!preg_match('/^@[A-Za-z0-9._]{1,30}$/', $s)) return [null, 'Esse @ não parece um usuário do Instagram (letras, números, ponto e _ , até 30).'];
    if (preg_match('/\.\.|^@\.|\.$/', $s)) return [null, 'Esse @ não parece um usuário do Instagram.'];
    $s = mb_strtolower($s, 'UTF-8');
    if (strlen($s) < 3) return [null, 'O nome precisa de 2 a 24 caracteres.'];
  } else {
    $len = mb_strlen($s, 'UTF-8');
    if ($len < 2 || $len > 24) return [null, 'O nome precisa de 2 a 24 caracteres.'];
    if (!preg_match('/^[\p{L}\p{N} ._\-]+$/u', $s)) return [null, 'Use só letras, números, espaço, ponto, - e _.'];
    if (!preg_match('/\p{L}|\p{N}/u', $s)) return [null, 'Nome inválido.'];
  }
  if (palavrao($s)) return [null, 'Esse nome não é permitido. Escolha outro.'];
  return [$s, null];
}

function chaveNome($nome) { return preg_replace('/\s+/', ' ', normaliza($nome)); }

function posicao($db, $pontos) {
  $q = $db->prepare('SELECT COUNT(*) FROM ranking WHERE jogo = ? AND pontos > ?');
  $q->execute([JOGO, $pontos]);
  return (int)$q->fetchColumn() + 1;
}

try {
  $db = banco();
  $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  if ($metodo === 'GET') {
    $q = $db->prepare('SELECT nome, pontos, moedas, dist, data FROM ranking WHERE jogo = ? ORDER BY pontos DESC, data ASC LIMIT ' . TOP);
    $q->execute([JOGO]);
    $top = [];
    foreach ($q->fetchAll() as $i => $r) $top[] = ['pos' => $i + 1, 'nome' => $r['nome'], 'pontos' => (int)$r['pontos'], 'moedas' => (int)$r['moedas'], 'dist' => (int)$r['dist'], 'data' => $r['data']];
    $voce = null;
    if (isset($_GET['nome']) && is_string($_GET['nome'])) {
      [$nome] = limpaNome($_GET['nome']);
      if ($nome) {
        $q = $db->prepare('SELECT pontos FROM ranking WHERE jogo = ? AND chave = ?');
        $q->execute([JOGO, chaveNome($nome)]);
        $p = $q->fetchColumn();
        if ($p !== false) $voce = ['nome' => $nome, 'pos' => posicao($db, (int)$p), 'pontos' => (int)$p];
      }
    }
    sai(['ok' => true, 'jogo' => JOGO, 'top' => $top, 'voce' => $voce]);
  }

  if ($metodo !== 'POST') { header('Allow: GET, POST'); erro('Método não permitido.', 405); }

  $corpo = file_get_contents('php://input', false, null, 0, 4096);
  $d = json_decode($corpo ?: '', true);
  if (!is_array($d)) $d = $_POST;

  [$nome, $msg] = limpaNome($d['nome'] ?? '');
  if (!$nome) erro($msg);

  foreach (['pontos', 'moedas', 'dist'] as $k) if (!isset($d[$k]) || !is_numeric($d[$k]) || $d[$k] < 0 || $d[$k] > 1e9) erro('Pontuação inválida.');
  $pontos = (int)floor($d['pontos']); $moedas = (int)floor($d['moedas']); $dist = (int)floor($d['dist']);
  // plausibilidade: pontos = distância × 0,6 × multiplicador (até x30, x2 no dobro) + 5 × moedas × multiplicador
  if ($pontos < 1 || $dist < 1) erro('Pontuação inválida.');
  if ($dist > 2000000) erro('Pontuação inválida.');
  if ($moedas > $dist * 1.5 + 50) erro('Pontuação inválida.');
  if ($pontos > ($dist * 1.2 + $moedas * 5) * 30 * 1.1 + 100) erro('Pontuação inválida.');
  if ($pontos < $dist * 0.5 - 20) erro('Pontuação inválida.');

  $ip = ipHash();
  $agora = time();
  $db->prepare('DELETE FROM envios WHERE ts < ?')->execute([$agora - JANELA_SEG]);
  $q = $db->prepare('SELECT COUNT(*) FROM envios WHERE ip_hash = ? AND ts >= ?');
  $q->execute([$ip, $agora - JANELA_SEG]);
  if ((int)$q->fetchColumn() >= LIMITE_ENVIOS) erro('Muitos envios seguidos. Espere alguns minutos.', 429);
  $db->prepare('INSERT INTO envios (ip_hash, ts) VALUES (?, ?)')->execute([$ip, $agora]);

  $chave = chaveNome($nome);
  $data = gmdate('Y-m-d H:i:s');
  $db->beginTransaction();
  $q = $db->prepare('SELECT id, pontos FROM ranking WHERE jogo = ? AND chave = ?');
  $q->execute([JOGO, $chave]);
  $atual = $q->fetch();
  $melhorou = false;
  if (!$atual) {
    $db->prepare('INSERT INTO ranking (jogo, nome, chave, pontos, moedas, dist, data, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      ->execute([JOGO, $nome, $chave, $pontos, $moedas, $dist, $data, $ip]);
    $melhorou = true;
  } elseif ($pontos > (int)$atual['pontos']) {
    $db->prepare('UPDATE ranking SET nome = ?, pontos = ?, moedas = ?, dist = ?, data = ?, ip_hash = ? WHERE id = ?')
      ->execute([$nome, $pontos, $moedas, $dist, $data, $ip, $atual['id']]);
    $melhorou = true;
  }
  $db->commit();
  $melhor = $melhorou ? $pontos : (int)$atual['pontos'];
  sai(['ok' => true, 'nome' => $nome, 'pos' => posicao($db, $melhor), 'pontos' => $melhor, 'melhorou' => $melhorou]);
} catch (Throwable $e) {
  if (isset($db) && $db->inTransaction()) $db->rollBack();
  error_log('ranking.php: ' . $e->getMessage());
  erro('Ranking indisponível no momento.', 500);
}
