import os
import sys

import uvicorn


def main() -> None:
    backend_dir = os.path.dirname(__file__)
    src_path = os.path.join(backend_dir, "src")
    if src_path not in sys.path:
        sys.path.insert(0, src_path)

    uvicorn.run("aero.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
