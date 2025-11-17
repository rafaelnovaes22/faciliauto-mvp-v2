#!/bin/bash
# Execute este script e cole seu GitHub token quando solicitado

read -sp "Cole seu GitHub Personal Access Token: " TOKEN
echo ""
cd /home/rafaelnovaes22/faciliauto-mvp-v2
git push https://$TOKEN@github.com/rafaelnovaes22/faciliauto-mvp-v2.git main
echo "Push concluído!"
