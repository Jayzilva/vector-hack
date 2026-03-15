# commands

create uv project

```bash
uv init backend
```

run main.py file. This command will start the virtual environment and execute the main.py file.

```bash
uv run main.py
```

Install fastapi package with standard dependencies.

```bash
uv add "fastapi[standard]"
```

Run the development server for the FastAPI application.

```bash
uv run fastapi dev
```

This command will synchronize the virtual environment with the dependencies specified in the project configuration.

```bash
uv sync
```
