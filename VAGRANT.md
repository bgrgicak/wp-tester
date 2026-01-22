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

### Start Claude Code

**Quick start (recommended):**
```bash
npm run claude
```

This command will:
1. Start the VM (`vagrant up`)
2. Run Claude Code in the VM (`claude-yolo`)
3. Suspend the VM when you exit (`vagrant suspend`)

**Manual approach:**
```bash
# SSH into the VM
vagrant ssh

# Run Claude Code without permission prompts
claude --dangerously-skip-permissions

# Or use the alias
claude-yolo
```


## Daily Usage

**Quick workflow (recommended):**
```bash
npm run claude  # Starts VM, runs Claude, then suspends on exit
```

**Manual VM control:**

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

**Reload and reprovision (after Vagrantfile changes):**
```bash
vagrant reload --provision
```

**Destroy the VM (clean slate):**
```bash
vagrant destroy
vagrant up  # Rebuild from scratch
```
