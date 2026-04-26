import os
import shutil
import json
import subprocess
import re
import sys
import argparse
import tempfile
import time
from datetime import datetime

# --- Configuration ---
UPDATE_DIR = "___update"
BACKUP_PREFIX = ".backup_synch_"
FILES_TO_OVERWRITE = ["index.html", "tsconfig.json", "package-lock.json"]

# --- Colors for Terminal ---
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    @staticmethod
    def log(msg, level="info"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        if level == "info":
            print(f"{Colors.OKBLUE}[INFO {timestamp}]{Colors.ENDC} {msg}")
        elif level == "success":
            print(f"{Colors.OKGREEN}[OK {timestamp}]{Colors.ENDC} {msg}")
        elif level == "warn":
            print(f"{Colors.WARNING}[WARN {timestamp}]{Colors.ENDC} {msg}")
        elif level == "error":
            print(f"{Colors.FAIL}[ERROR {timestamp}]{Colors.ENDC} {msg}")

class PortfolioUpdater:
    def __init__(self, auto_confirm=False, no_deploy=False, no_commit=False):
        self.root_dir = os.getcwd()
        self.update_path = os.path.join(self.root_dir, UPDATE_DIR)
        self.backup_path = None
        self.auto_confirm = auto_confirm
        self.skip_deploy = no_deploy
        self.skip_commit = no_commit

    def validate_environment(self):
        """Ensure the update directory exists and environment is sane."""
        if not os.path.exists(self.update_path):
            Colors.log(f"Update directory '{UPDATE_DIR}' not found. Aborting.", "error")
            sys.exit(1)
        
        # Check if git is initialized
        if not os.path.exists(os.path.join(self.root_dir, ".git")):
            Colors.log("Not a git repository. Some operations may fail.", "warn")

    def create_backup(self):
        """Create a temporary backup of critical files before modification."""
        self.backup_path = tempfile.mkdtemp(prefix=BACKUP_PREFIX)
        Colors.log(f"Creating safety backup at: {self.backup_path}...", "info")
        
        try:
            # Backup src
            if os.path.exists(os.path.join(self.root_dir, "src")):
                shutil.copytree(os.path.join(self.root_dir, "src"), os.path.join(self.backup_path, "src"))
            
            # Backup configs
            for f in ["package.json", "vite.config.ts"] + FILES_TO_OVERWRITE:
                src_f = os.path.join(self.root_dir, f)
                if os.path.exists(src_f):
                    shutil.copy2(src_f, os.path.join(self.backup_path, f))
        except Exception as e:
            Colors.log(f"Backup failed: {e}", "error")
            sys.exit(1)

    def restore_backup(self):
        """Restore files from backup in case of failure."""
        if not self.backup_path or not os.path.exists(self.backup_path):
            return

        Colors.log("Restoring from backup due to failure...", "warn")
        try:
            # Restore src
            src_path = os.path.join(self.root_dir, "src")
            if os.path.exists(src_path):
                shutil.rmtree(src_path)
            if os.path.exists(os.path.join(self.backup_path, "src")):
                shutil.copytree(os.path.join(self.backup_path, "src"), src_path)

            # Restore configs
            for f in os.listdir(self.backup_path):
                if f == "src": continue
                shutil.copy2(os.path.join(self.backup_path, f), os.path.join(self.root_dir, f))
            
            Colors.log("Restoration complete.", "success")
        except Exception as e:
            Colors.log(f"CRITICAL: Failed to restore backup! Manual intervention required at {self.backup_path}", "error")

    def cleanup(self, success=True):
        """Cleanup backup and update directory."""
        if self.backup_path and os.path.exists(self.backup_path):
            if success:
                shutil.rmtree(self.backup_path)
            else:
                Colors.log(f"Backup kept at {self.backup_path} for manual inspection.", "info")

        if success and os.path.exists(self.update_path):
            Colors.log(f"Removing update directory '{UPDATE_DIR}'...", "info")
            shutil.rmtree(self.update_path)

    def run_command(self, cmd, shell=True):
        """Run a shell command and handle errors."""
        try:
            Colors.log(f"Running: {cmd}", "info")
            subprocess.check_call(cmd, shell=shell)
        except subprocess.CalledProcessError:
            Colors.log(f"Command failed: {cmd}", "error")
            raise Exception("Command execution failed")

    def merge_package_json(self):
        Colors.log("Smart merging package.json...", "info")
        old_path = os.path.join(self.root_dir, "package.json")
        new_path = os.path.join(self.update_path, "package.json")

        with open(old_path, 'r') as f: old_pkg = json.load(f)
        with open(new_path, 'r') as f: new_pkg = json.load(f)

        # 1. Preserve critical keys
        for key in ['name', 'version', 'homepage']:
            if key in old_pkg:
                new_pkg[key] = old_pkg[key]
        
        # 2. Merge Scripts (Preserve existing custom scripts, update/overwrite core ones from new)
        if 'scripts' not in new_pkg: new_pkg['scripts'] = {}
        if 'scripts' in old_pkg:
            for s in ['predeploy', 'deploy']:
                if s in old_pkg['scripts']:
                    new_pkg['scripts'][s] = old_pkg['scripts'][s]

        # 3. Smart Dependency Merge
        for dep_type in ['dependencies', 'devDependencies']:
            if dep_type not in old_pkg: continue
            if dep_type not in new_pkg: new_pkg[dep_type] = {}
            
            # Add local deps that are missing in new_pkg (like gh-pages)
            for dep, ver in old_pkg[dep_type].items():
                if dep not in new_pkg[dep_type]:
                    new_pkg[dep_type][dep] = ver
                    Colors.log(f"Preserving local dependency: {dep}", "info")

        with open(old_path, 'w') as f:
            json.dump(new_pkg, f, indent=2)

    def merge_vite_config(self):
        Colors.log("Smart merging vite.config.ts...", "info")
        old_path = os.path.join(self.root_dir, "vite.config.ts")
        new_path = os.path.join(self.update_path, "vite.config.ts")

        with open(old_path, 'r') as f: old_content = f.read()
        with open(new_path, 'r') as f: new_content = f.read()

        # Robust regex to find base property: base: "..." or base: '...'
        base_match = re.search(r'base\s*:\s*(["\'])(.*?)\1', old_content)
        
        if base_match:
            base_full_line = base_match.group(0) # e.g., base: "/SchemaFlow/"
            Colors.log(f"Found existing base config: {base_full_line}", "info")
            
            if re.search(r'base\s*:', new_content):
                # Replace existing base in new file
                new_content = re.sub(r'base\s*:\s*(["\']).*?\1', base_full_line, new_content)
            else:
                # Inject base into the return object of defineConfig
                # This handles both defineConfig({}) and defineConfig(() => ({ ... }))
                # Look for the first occurrence of 'return {' and inject after it
                if "return {" in new_content:
                    new_content = new_content.replace("return {", f"return {{\n    {base_full_line},", 1)
                elif "defineConfig({" in new_content:
                    new_content = new_content.replace("defineConfig({", f"defineConfig({{\n    {base_full_line},", 1)
                else:
                    Colors.log("Could not find injection point in vite.config.ts, manual check required.", "warn")

        with open(old_path, 'w') as f:
            f.write(new_content)

    def get_git_branch(self):
        try:
            branch = subprocess.check_output("git rev-parse --abbrev-ref HEAD", shell=True).decode().strip()
            return branch
        except:
            return "main"

    def execute(self):
        try:
            self.validate_environment()
            self.create_backup()

            # 1. Source Migration
            Colors.log("Migrating source files...", "info")
            src_path = os.path.join(self.root_dir, "src")
            if os.path.exists(src_path):
                shutil.rmtree(src_path)
            shutil.copytree(os.path.join(self.update_path, "src"), src_path)

            # 2. Merges
            self.merge_package_json()
            self.merge_vite_config()

            # 3. Overwrites
            for f in FILES_TO_OVERWRITE:
                Colors.log(f"Overwriting {f}...", "info")
                shutil.copy2(os.path.join(self.update_path, f), os.path.join(self.root_dir, f))

            # 4. Install & Build
            self.run_command("npm install")
            self.run_command("npm run build")

            # 5. Deployment
            if not self.skip_deploy:
                if self.auto_confirm:
                    should_deploy = True
                else:
                    resp = input(f"{Colors.WARNING}[?] Deploy to GitHub Pages? (y/N): {Colors.ENDC}")
                    should_deploy = resp.lower() == 'y'
                
                if should_deploy:
                    self.run_command("npm run deploy")
                else:
                    Colors.log("Skipping deployment.", "info")

            # 6. Cleanup
            self.cleanup(success=True)

            # 7. Git Commit
            if not self.skip_commit:
                if self.auto_confirm:
                    should_commit = True
                else:
                    resp = input(f"{Colors.WARNING}[?] Commit and push changes? (y/N): {Colors.ENDC}")
                    should_commit = resp.lower() == 'y'

                if should_commit:
                    branch = self.get_git_branch()
                    Colors.log(f"Committing to branch '{branch}'...", "info")
                    self.run_command("git add .")
                    self.run_command('git commit -m "chore: execute synch-update protocol"')
                    self.run_command(f"git push origin {branch}")

            Colors.log("Synch-Update Protocol Completed Successfully.", "success")

        except Exception as e:
            Colors.log(f"Protocol FAILED: {str(e)}", "error")
            self.restore_backup()
            self.cleanup(success=False)
            sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated Portfolio Synchronization & Update Tool")
    parser.add_argument("-y", "--yes", action="store_true", help="Auto-confirm all prompts")
    parser.add_argument("--no-deploy", action="store_true", help="Skip deployment step")
    parser.add_argument("--no-commit", action="store_true", help="Skip git commit/push step")
    
    args = parser.parse_args()
    
    updater = PortfolioUpdater(
        auto_confirm=args.yes,
        no_deploy=args.no_deploy,
        no_commit=args.no_commit
    )
    updater.execute()
