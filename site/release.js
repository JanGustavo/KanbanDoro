// Releases 0.x são pré-lançamentos; a rota /releases/latest do GitHub não as inclui.
(async () => {
  const link = document.getElementById('download-extension');
  const status = document.getElementById('release-status');
  if (!link || !status) return;

  try {
    const response = await fetch('https://api.github.com/repos/JanGustavo/KanbanDoro/releases?per_page=30', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error('GitHub indisponível');
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Resposta inesperada');

    const packages = releases.filter(release => !release.draft && Array.isArray(release.assets))
      .flatMap(release => release.assets
        .filter(asset => asset.name === `KanbanDoro-${release.tag_name}.zip`
          && /^v\d+\.\d+\.\d+$/.test(release.tag_name)
          && typeof asset.browser_download_url === 'string'
          && asset.browser_download_url.startsWith(`https://github.com/JanGustavo/KanbanDoro/releases/download/${release.tag_name}/`))
        .map(asset => ({ tag: release.tag_name, published: Date.parse(release.published_at) || 0, url: asset.browser_download_url })));
    packages.sort((a, b) => b.published - a.published);
    if (packages.length) {
      link.href = packages[0].url;
      link.firstChild.textContent = `Baixar extensão ${packages[0].tag} `;
      status.textContent = 'Arquivo ZIP da release mais recente. Descompacte antes de carregar a extensão.';
    } else {
      status.textContent = 'Ainda não há um pacote publicado. Acompanhe as releases no GitHub.';
    }
  } catch {
    status.textContent = 'Não foi possível consultar as releases agora. Confira os downloads no GitHub.';
  }
})();
