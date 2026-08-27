#!/usr/bin/env bash
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
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$target" | awk '{print toupper($1)}')"
  else
    actual="$(sha256sum "$target" | awk '{print toupper($1)}')"
  fi
  if [[ "$actual" != "${cert_hashes[$index]}" ]]; then
    echo "Ошибка: контрольная сумма $name не совпадает." >&2
    exit 1
  fi
done

echo "CERTIFICATES_VERIFIED=5"
(( dry_run == 1 )) && exit 0

import_intermediate() {
  local out
  if ! out="$(sudo security import "$1" -k /Library/Keychains/System.keychain 2>&1)"; then
    if [[ "$out" == *"already exists in the keychain"* ]]; then
      return 0
    fi
    printf '%s\n' "$out" >&2
    return 1
  fi
}

echo "macOS попросит пароль администратора для системного хранилища."
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$work_dir/russian_trusted_root_ca.cer"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$work_dir/russian_trusted_root_ca_gost_2025.cer"
import_intermediate "$work_dir/russian_trusted_sub_ca.cer"
import_intermediate "$work_dir/russian_trusted_sub_ca_2024.cer"
import_intermediate "$work_dir/russian_trusted_sub_ca_gost_2025.cer"

echo "Готово. Все пять сертификатов добавлены в системную связку ключей."
echo "Перезапустите браузер."
