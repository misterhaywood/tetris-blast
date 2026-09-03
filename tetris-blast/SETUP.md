# Setup: IntelliJ IDEA and GitHub

Step-by-step, assuming nothing is installed yet beyond the IDE.

---

## Part 1 — Open the project in IntelliJ IDEA

This is a static web project. There is no SDK, no `npm install`, no run
configuration, no build step. IntelliJ just needs to know where the folder is.

1. Unzip `tetris-blast.zip` somewhere permanent — `Documents/projects/tetris-blast`
   is fine. Avoid leaving it in Downloads; you'll be pushing it to git later.

2. Open IntelliJ IDEA. On the welcome screen click **Open** (not *New Project*).
   If a project is already open, use **File → Open**.

3. Select the **`tetris-blast` folder itself** — the one containing `index.html`.
   Don't select `index.html`, and don't select the folder above it. Click **OK**.

4. If IDEA asks whether to trust the project, choose **Trust Project**.

5. In the Project pane on the left you should now see:

   ```
   tetris-blast
   ├── css/
   ├── dist/
   ├── js/
   ├── build.js
   ├── index.html
   └── README.md
   ```

### Running it

Open `index.html` in the editor. Hover near the top-right corner of the editor
window — a row of small browser icons appears. Click one.

IDEA serves the page on its built-in web server at
`http://localhost:63342/tetris-blast/index.html`. That matters: opening the file
directly from Finder/Explorer also works here, but the built-in server gives you
**live edit** — save any file and the browser refreshes on its own.

If the icons don't appear, right-click `index.html` in the Project pane →
**Open In → Browser → Chrome**.

### Community Edition note

IntelliJ IDEA **Community** has limited JavaScript and HTML support — you'll get
basic editing but weaker autocomplete, and the browser-icon toolbar may be
missing. Everything still runs; you'd just right-click → Open in Browser.
**IDEA Ultimate** and **WebStorm** have full web support. WebStorm is free for
students, which is worth knowing if you have a `.edu` address.

### Useful shortcuts once you're in

| Shortcut | Does |
| --- | --- |
| `Shift` `Shift` | Search everywhere — jump to any file or function by name |
| `Ctrl/Cmd` `B` | Go to the definition under the cursor |
| `Alt/Opt` `F7` | Find every usage of a function |
| `Ctrl/Cmd` `Alt/Opt` `L` | Reformat the current file |

---

## Part 2 — Push it to GitHub

### 2a. One-time setup (skip anything you've already done)

Check whether git is installed — open a terminal and run:

```bash
git --version
```

If that errors, install it: **macOS** `xcode-select --install`,
**Windows** download from `git-scm.com`, **Linux** `sudo apt install git`.

Then tell git who you are (once per machine):

```bash
git config --global user.name "Alex Bryant"
git config --global user.email "your@email.com"
```

Use the email tied to your GitHub account, otherwise your commits won't be
attributed to your profile.

### 2b. Create the empty repository on GitHub

1. Go to **github.com/new**.
2. **Repository name:** `tetris-blast`
3. **Visibility:** Public (required for free GitHub Pages hosting).
4. Leave **"Add a README"**, **"Add .gitignore"** and **"Choose a license"**
   all **unchecked**. The project already has a README and a `.gitignore`, and
   initialising with files makes the first push conflict.
5. Click **Create repository**. Leave the page open — you'll want the URL.

### 2c. Push from the terminal

`cd` into the project folder, then:

```bash
cd path/to/tetris-blast

git init
git add .
git commit -m "Tetris Blast: canvas engine, six themes, six pixel fighters"
git branch -M main
git remote add origin https://github.com/alex-b005/tetris-blast.git
git push -u origin main
```

Replace `alex-b005` if you're pushing to a different account.

When it asks for a password, **your GitHub password will not work**. GitHub
requires a Personal Access Token:

1. GitHub → your avatar → **Settings** → **Developer settings**
2. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
3. Tick the **`repo`** scope, set an expiry, generate.
4. Copy the token immediately — it's shown once — and paste it as the password.

A password manager is the right home for that token.

### 2d. Doing it from inside IntelliJ instead

If you'd rather not touch the terminal:

1. **VCS → Share Project on GitHub** (or **Git → GitHub → Share Project on GitHub**)
2. Log in when prompted — IDEA handles the token for you.
3. Name it `tetris-blast`, uncheck **Private**, click **Share**.
4. It'll offer to add all files to the first commit. Accept.

After that, `Ctrl/Cmd` `K` commits and `Ctrl/Cmd` `Shift` `K` pushes.

---

## Part 3 — Put it online with GitHub Pages

1. On the repo page: **Settings** → **Pages** (left sidebar).
2. Under **Source**, choose **Deploy from a branch**.
3. Branch: **`main`**, folder: **`/ (root)`**. Click **Save**.
4. Wait a minute or two, then reload the Pages settings screen for the link.

Your game will be live at:

```
https://alex-b005.github.io/tetris-blast/
```

It works because GitHub Pages serves `index.html` from the repo root, and every
path in this project is relative (`css/style.css`, `js/config.js`), so nothing
breaks when the site moves to a subdirectory.

### Putting it on a resume or portfolio

Link the live Pages URL, not the repo — recruiters click one thing. Put the
repo link second. In the repo's **About** panel (the gear icon, top right of the
repo page) add the Pages URL under **Website** and a one-line description, so
the link renders on your GitHub profile.

---

## Making changes later

```bash
git add .
git commit -m "what you changed"
git push
```

Pages redeploys automatically within a minute of the push.

If you edit files under `js/` or `css/`, regenerate the standalone build too:

```bash
node build.js
```

That rewrites `dist/tetris-blast.html` with everything inlined. It needs Node
installed; if you don't have it, the multi-file version still works fine on its
own and you can just delete `dist/`.
