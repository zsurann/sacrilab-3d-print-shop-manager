// Errori di Telegram tradotti per chi usa l'app; `unlink` = la sessione non vale più.
export function explain(e) {
  const t = e?.text || '';
  if (t.startsWith('FLOOD_WAIT')) return [429, `Telegram chiede di attendere ${e.seconds ?? 'qualche'} secondi prima di inviare di nuovo.`];
  if (t === 'PEER_FLOOD') return [429, 'Telegram ha limitato il tuo account: per ora non è possibile inviare.'];
  if (/^(AUTH_KEY_UNREGISTERED|SESSION_REVOKED|SESSION_EXPIRED|USER_DEACTIVATED)/.test(t)) return [409, 'Account Telegram scollegato: il proprietario deve ricollegarlo dalle Impostazioni.', true];
  if (t === 'PHONE_CODE_INVALID' || t === 'PHONE_CODE_EXPIRED') return [400, 'Codice errato o scaduto: richiedine uno nuovo.'];
  if (t === 'PASSWORD_HASH_INVALID') return [400, 'Password della verifica in due passaggi errata.'];
  if (t === 'PHONE_NUMBER_INVALID') return [400, 'Numero non valido: usa il formato +39…'];
  return [502, e?.message || String(e)];
}
