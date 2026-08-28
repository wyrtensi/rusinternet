#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then
  echo "Запустите через bash: bash install-linux.sh (в Alpine: apk add bash)" >&2
  exit 1
fi
set -euo pipefail

dry_run=0
[[ "${1:-}" == "--dry-run" ]] && dry_run=1
base_url="https://rusinternet.com/downloads/certificates"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

cert_names=(
  russian_trusted_root_ca.cer
  russian_trusted_root_ca_gost_2025.cer
  russian_trusted_sub_ca.cer
  russian_trusted_sub_ca_2024.cer
  russian_trusted_sub_ca_gost_2025.cer
)
cert_hashes=(
  936A43FEA6E8E525BCC0F81ACD9C3D21B4FC4B9B68ACEA7906D698005AFC6504
  5B51DB721B7C34958ED7432AE917A91297DD37508B2CAE4F858FFBAC6BC525EF
  F0AE589F36774F29EF3648F7984B08D42FCCE6F1FFEEB6236D773DAEB2744EA6
  6F9D829C8E6712444FCE3624658D8788672849C5D5B7B53FD9CF7E83EAC4193E
  B809281BF07B865BCDD7F5746BF1EBB7CCEE093D5C63B016DD91EE3B22CDA8D1
)

for index in "${!cert_names[@]}"; do
  name="${cert_names[$index]}"
  target="$work_dir/$name"
  if [[ -n "${RUSINTERNET_CERT_SOURCE:-}" ]]; then
    cp "${RUSINTERNET_CERT_SOURCE}/$name" "$target"
  else
    curl -fsSL "$base_url/$name" -o "$target"
  fi
  actual="$(sha256sum "$target" | awk '{print toupper($1)}')"
  if [[ "$actual" != "${cert_hashes[$index]}" ]]; then
    echo "Ошибка: контрольная сумма $name не совпадает." >&2
    exit 1
  fi
done

echo "CERTIFICATES_VERIFIED=5"

pem_dir="$work_dir/pem"
mkdir "$pem_dir"
root_names=(russian_trusted_root_ca.cer russian_trusted_root_ca_gost_2025.cer)
# Convert the two roots to PEM without requiring openssl (absent on minimal
# systems and containers): the RSA root is already PEM; only the GOST root is
# DER, and base64 (present in coreutils and busybox) turns DER into PEM.
der_to_pem() {
  { echo "-----BEGIN CERTIFICATE-----"; base64 "$1" | tr -d '\r\n' | fold -w 64; echo; echo "-----END CERTIFICATE-----"; } > "$2"
}
for name in "${root_names[@]}"; do
  src="$work_dir/$name"; out="$pem_dir/${name%.cer}.crt"
  if grep -q -- '-----BEGIN CERTIFICATE-----' "$src"; then
    cp "$src" "$out"
  else
    der_to_pem "$src" "$out"
  fi
done
echo "ROOT_CERTIFICATES_CONVERTED=2"
(( dry_run == 1 )) && exit 0

# Only the two roots become trust anchors. Each store expects a different
# layout, so the store is chosen by which anchor directory actually exists,
# not just by which update command is on PATH (fixes false success on Arch).
install_anchors_flat() {
  local dir="$1" name
  sudo mkdir -p "$dir"
  for name in "${root_names[@]}"; do
    sudo cp "$pem_dir/${name%.cer}.crt" "$dir/rusinternet-${name%.cer}.crt"
  done
}

if command -v update-ca-trust >/dev/null 2>&1 && [[ -d /etc/pki/ca-trust/source/anchors ]]; then
  install_anchors_flat /etc/pki/ca-trust/source/anchors            # RHEL / Fedora
  sudo update-ca-trust extract
elif command -v update-ca-trust >/dev/null 2>&1 && [[ -d /etc/ca-certificates/trust-source/anchors ]]; then
  install_anchors_flat /etc/ca-certificates/trust-source/anchors   # Arch
  sudo update-ca-trust
elif command -v update-ca-certificates >/dev/null 2>&1 && [[ -d /usr/local/share/ca-certificates ]]; then
  sudo mkdir -p /usr/local/share/ca-certificates/rusinternet       # Debian / Ubuntu
  sudo cp "$pem_dir"/*.crt /usr/local/share/ca-certificates/rusinternet/
  sudo update-ca-certificates
elif command -v update-ca-certificates >/dev/null 2>&1 && [[ -d /etc/pki/trust/anchors ]]; then
  install_anchors_flat /etc/pki/trust/anchors                      # openSUSE
  sudo update-ca-certificates
else
  echo "Не найдено поддерживаемое системное хранилище сертификатов." >&2
  exit 1
fi

echo "Готово. Два корневых сертификата добавлены в системное хранилище."

# Optional, per-user (no sudo): also add the two roots to the Chromium NSS
# store so Chromium/Chrome trust them without a manual import.
if command -v certutil >/dev/null 2>&1 && [[ -d "$HOME/.pki/nssdb" ]]; then
  for name in "${root_names[@]}"; do
    certutil -d sql:"$HOME/.pki/nssdb" -A -t "C,," -n "rusinternet ${name%.cer}" -i "$pem_dir/${name%.cer}.crt" 2>/dev/null || true
  done
  echo "Дополнительно: корни добавлены в NSS-хранилище Chromium (~/.pki/nssdb)."
fi

echo "Перезапустите браузер. Firefox использует собственное хранилище — для него может потребоваться ручной импорт."
