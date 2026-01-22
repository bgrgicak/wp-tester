vm_name = File.basename(Dir.getwd)

Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-24.04"

  config.vm.synced_folder ".", "/agent-workspace", type: "virtualbox"

  config.vm.provider "virtualbox" do |vb|
    vb.memory = "4096"
    vb.cpus = 2
    vb.gui = false
    vb.name = vm_name
    vb.customize ["modifyvm", :id, "--audio", "none"]
    vb.customize ["modifyvm", :id, "--usb", "off"]
  end

  config.vm.provision "shell", inline: <<-SHELL
    export DEBIAN_FRONTEND=noninteractive

    apt-get update
    apt-get install -y docker.io nodejs npm git unzip
    npm install -g @anthropic-ai/claude-code --no-audit

    usermod -aG docker vagrant
    chown -R vagrant:vagrant /agent-workspace

    # Create claude-yolo command wrapper
    cat > /usr/local/bin/claude-yolo <<'EOF'
#!/bin/bash
claude --dangerously-skip-permissions "$@"
EOF
    chmod +x /usr/local/bin/claude-yolo

    # Also add alias to vagrant user's bashrc for convenience
    echo 'alias claude-yolo="claude --dangerously-skip-permissions"' >> /home/vagrant/.bashrc

    # Start SSH sessions in /agent-workspace and auto-launch claude-yolo
    cat >> /home/vagrant/.bashrc <<'BASHRC'
cd /agent-workspace

BASHRC

  SHELL
end
