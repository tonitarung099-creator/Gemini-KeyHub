"""
Gemini KeyHub bridge for AnswerDotAI/gclientid.

This file does not copy gclientid implementation. It calls the upstream
Apache-2.0 licensed package as a bundled dependency and adapts its public
operations for Gemini KeyHub's desktop UI.
"""

import asyncio
import json
import sys
from pathlib import Path

from gclientid.config import project_id
from gclientid.oauth import (
    connect_browser,
    console_account,
    create_client,
    publish_app,
    set_scopes,
    setup_auth,
)
from gclientid.projects import ensure_project_ui

CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


def emit(prefix: str, payload) -> None:
    print(f"{prefix}{json.dumps(payload, ensure_ascii=False)}", flush=True)


async def bootstrap(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    client_path = output_dir / "oauth-client-desktop.json"
    warnings: list[str] = []

    cdp = None
    page = None
    try:
        cdp, page = await connect_browser(default_browser=False, timeout=90)
        email = await console_account(page, timeout=600)
        pid = project_id(email)

        emit("GKH_STATUS=", {"step": "project", "message": f"Menyiapkan project {pid}..."})
        await ensure_project_ui(page, pid, name="Gemini KeyHub", timeout=120)

        emit("GKH_STATUS=", {"step": "oauth_app", "message": "Menyiapkan OAuth app..."})
        await setup_auth(
            page,
            pid,
            name="Gemini KeyHub",
            internal=False,
            support_email=email,
            accept_terms=True,
            timeout=30,
            terms_timeout=600,
        )

        emit("GKH_STATUS=", {"step": "scope", "message": "Menambahkan Google Cloud scope..."})
        await set_scopes(page, pid, scopes=[CLOUD_SCOPE], timeout=30)

        try:
            emit("GKH_STATUS=", {"step": "publish", "message": "Mempublikasikan OAuth app..."})
            await publish_app(page, pid, timeout=30)
        except Exception as exc:
            warnings.append(
                "OAuth app berhasil disiapkan tetapi belum dapat dipublish otomatis: "
                + str(exc)
            )

        if client_path.exists():
            data = json.loads(client_path.read_text(encoding="utf-8"))
        else:
            emit("GKH_STATUS=", {"step": "client", "message": "Membuat OAuth Desktop Client..."})
            data = await create_client(
                page,
                pid,
                path=client_path,
                name="Gemini KeyHub Desktop",
                desktop=True,
                timeout=30,
            )

        installed = data.get("installed") or {}
        client_id = installed.get("client_id")
        client_secret = installed.get("client_secret")
        if not client_id:
            raise RuntimeError("OAuth Desktop Client selesai dibuat tetapi Client ID tidak ditemukan.")

        result = {
            "account": email,
            "projectId": pid,
            "clientPath": str(client_path),
            "clientId": client_id,
            "clientSecret": client_secret,
            "clientIdHint": (
                f"{client_id[:6]}…{client_id[-28:]}"
                if len(client_id) > 40
                else client_id
            ),
            "warnings": warnings,
        }
        emit("GKH_RESULT=", result)
    finally:
        if page is not None:
            try:
                await page.close()
            except Exception:
                pass
        if cdp is not None:
            try:
                await cdp.close()
            except Exception:
                pass


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "selftest":
        emit("GKH_SELFTEST=", {"ok": True, "gclientid": True})
        return 0

    if len(sys.argv) != 3 or sys.argv[1] != "bootstrap":
        emit("GKH_ERROR=", {"message": "Usage: gclientid-bridge bootstrap <output_dir>"})
        return 2

    try:
        asyncio.run(bootstrap(Path(sys.argv[2])))
        return 0
    except Exception as exc:
        emit("GKH_ERROR=", {"message": str(exc), "type": type(exc).__name__})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
