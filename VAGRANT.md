# Vagrant Development Environment

This project includes a Vagrant configuration for running Claude Code in an isolated VM environment with the `--dangerously-skip-permissions` flag safely.

## Prerequisites

You need to have installed on your host machine:
- [Vagrant](https://www.vagrantup.com/downloads)
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

## Setup

### First Time Setup

```bash
# From your project directory (wp-tester)
vagrant up
```

This will:
- Download the Ubuntu 24.04 base box (if needed)
- Create a VM with 4GB RAM and 2 CPUs
- Install Docker, Node.js, npm, git, and Claude Code
- Mount your project directory to `/agent-workspace` in the VM
- Configure the vagrant user for Docker access

### Start Claude Code

```bash
# SSH into the VM
vagrant ssh

# Navigate to your project (automatically synced)
cd /agent-workspace

# Run Claude Code without permission prompts
claude --dangerously-skip-permissions
```

Or use the alias:
```bash
claude-yolo
```

## Daily Usage

**Start the VM:**
```bash
vagrant up
```

**Connect to the VM:**
```bash
vagrant ssh
```

**Suspend the VM (recommended when done):**
```bash
exit  # Exit SSH session first
vagrant suspend
```

**Stop the VM completely:**
```bash
vagrant halt
```

**Destroy the VM (clean slate):**
```bash
vagrant destroy
vagrant up  # Rebuild from scratch
```

## VM Configuration

- **OS:** Ubuntu 24.04 (bento/ubuntu-24.04)
- **Memory:** 4096 MB
- **CPUs:** 2
- **Shared Folder:** Current directory → `/agent-workspace`
- **Sync Type:** VirtualBox shared folders

## Security Notes

### Protected Against:
- Accidental filesystem damage outside the project
- Unintended package installations on host
- Configuration modifications on host
- User errors during agent operation

### Not Protected Against:
- Project deletion (bidirectional file sync)
- VM escape exploits
- Network-level incidents
- Data exfiltration risks

## Installed Software (in VM)

- Docker
- Node.js & npm
- Git
- Unzip
- Claude Code (global installation)

## Tips

- The VM name will automatically be set to your project directory name (wp-tester)
- All changes in `/agent-workspace` are immediately reflected on your host machine
- You can rebuild the VM anytime with `vagrant destroy && vagrant up` for a fresh environment
- Use `vagrant status` to check the VM state
