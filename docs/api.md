# Civitai calls

civitai-sync talks to the account you choose. `civitai.com` and `civitai.red` are different catalogs: a library synced against one is not the library from the other. The account check, `auth.getUser`, stays on `civitai.com`. Every call sends `Referer`. Generations older than about 30 days are no longer returned.

| Call | Role |
|---|---|
| `auth.getUser` | The account. Host pinned to `civitai.com`. |
| `GET /api/v1/me` | Fallback account read. |
| `orchestrator.queryGeneratedImages` | This account's generations, inside the retention window. |
| `orchestrator.getWorkflow` | Workflow detail while that job is still live. |
| `post.getInfinite`, `post.get`, `post.getEdit` | Post list, one post, and the uncapped image list. |
| `image.getGenerationData` | Prompt and generation parameters for a posted image. |
| `image.getInfinite` | Newest images on this account. An image added to an older post is found here. |
| `comics.getMyProjects`, `comics.getProjectShell`, `comics.getChapter` | This account's comics. |
| `model3d.getInfinite`, `model3d.getById`, `model3d.getFiles` | This account's 3D models and their files. |
| `model3d.getByPostId` | The 3D id attached to a post, when the post itself did not name it. |
| `GET /api/v1/models/{id}`, `GET /api/v1/models?username=` | Model records and this account's model list, for the local name cache. |
| `GET /api/v1/model-versions/{id}`, `modelVersion.getById` | One model version, for that cache. |
| `tag.getById` | A tag name for that cache. |
| `GET /api/v1/images` | One page, used to learn the image CDN host. This is not the download of your images. |
| File URLs | Media bytes from the URLs in the saved JSON, including the image CDN. That CDN host does not follow the catalog host. |

This program does not call the public comic-reader procedures, and it does not call 3D write procedures such as `trackDownload` or publish.
