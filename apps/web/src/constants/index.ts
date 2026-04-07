import { TarotCard, Spread } from '@/types';

export const TAROT_CARDS: TarotCard[] = [
  {
    id: 'high-priestess',
    name: '女祭司',
    englishName: 'The High Priestess',
    arcana: 'Major Arcana II',
    element: 'Water',
    description: '女祭司代表着直觉、潜意识、神秘和内在的力量。她坐在智慧与知识的门槛上，守卫着超越感官世界的奥秘。当这张牌出现时，它提醒我们要倾听内在的声音，信任直觉。',
    uprightKeywords: ['直觉', '洞察力', '神圣女性', '潜意识'],
    reversedKeywords: ['压抑直觉', '肤浅', '秘密暴露', '沉默'],
    symbolism: [
      '黑白双柱 (Boaz & Jachin)：代表二元性，如阴阳、生死、明暗。',
      '妥拉经卷 (Torah)：象征着神圣的律法和被部分遮蔽的真理。',
      '月亮冠冕：象征着与月亮周期的联系以及对直觉能量的掌控。'
    ],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUeKgYdkjV79FC0fByBvhnNBoVcKRHeLozDcRZ51Uv-wRY3M_5DWLuXxutrEkyQyEFfSuK70Ou_x1BT0uCjYolKxbSHRG_K3ac8NEtNy3NtQLHZ6cJ4JIGizjqjCylyLj4kuhCt0Iuox7d5PgpGYc9nbddVkwyQ6XArPoXwY0n_xFvVb76CvxcqtM1X6jkIzkhldYi-o-OVSK-fi2ZyiyfwtfDtzzC0WCOYxj9fQmaRHGWp9ERxE2PKn-NV5jEXTU4o6N9jsCy0U0h'
  },
  {
    id: 'hermit',
    name: '隐者',
    englishName: 'The Hermit',
    arcana: 'Major Arcana IX',
    element: 'Earth',
    description: '隐者代表着孤独、内省和寻求真理。他提着灯笼在黑暗中独行，象征着内在智慧的指引。',
    uprightKeywords: ['智慧', '孤独', '内省', '指引'],
    reversedKeywords: ['孤立', '偏执', '鲁莽', '拒绝建议'],
    symbolism: ['灯笼：内在的智慧。', '手杖：权力和平衡。', '雪山：精神的高峰。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBAAxhd-XA8x1bWnDuPckvPMSSI_ZeRm1cikntzJ5sy9MvMCZqY1h8T5W3i9aHPHNrjDOyAPl9zYCLUUAd2Ciki_8O9oo_rW2m9kL6SwKpifFPzaIuiDaaEFRdiJk3AdHQDZM5mpccO02ja04qXJyfHXfUXH0PBOxh0LBnMH7E5Sm0PlSNptixbkJVe3eEzx9RQOCb0fYsF2cr8HNeSq7l3NBbLyRwrDCeO2wTkNb7gYBjjRf3N9fM1jwtKmrUCW2gGbk4dYfTSGeOB'
  },
  {
    id: 'star',
    name: '星星',
    englishName: 'The Star',
    arcana: 'Major Arcana XVII',
    element: 'Air',
    description: '星星代表着希望、灵感和宁静。在经历风暴后，它带来了治愈和对未来的信心。',
    uprightKeywords: ['希望', '灵感', '宁静', '治愈'],
    reversedKeywords: ['失望', '缺乏灵感', '悲观', '焦虑'],
    symbolism: ['大星：宇宙的指引。', '水：情感的流动。', '裸体：纯真和真实。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPetdBcsFa5DxU_TDIkTqx4SBbbAHwy8pvE_-nEyIRBCZmh1pyyLw9RfwvrcbLX8JIFaqxzFnSBzx4-QV6rPnZLUwRoV25hfEUh1RjfGQJET28jeQ0jiVScHBRgcBvhDgJkLzx9nfjU7Wi-sGr3gRXiIRi0nPvGFgamlbOZkqS8SJsK7bdfyOQwosddTl6MHh49abMuTQhiZ89HChEIwpmT7rE09bw3oHUtSPDxVi4NrO5mtn8D3T0tpVmS0cXGhLjWH1pWUnYbtRl'
  },
  {
    id: 'world',
    name: '世界',
    englishName: 'The World',
    arcana: 'Major Arcana XXI',
    element: 'Earth',
    description: '世界代表着完成、成功和统一。它是旅程的终点，也是新循环的开始。',
    uprightKeywords: ['完成', '成功', '统一', '旅行'],
    reversedKeywords: ['未完成', '缺乏闭合', '停滞', '延误'],
    symbolism: ['花环：胜利和循环。', '四元素：宇宙的完整。', '舞者：自由和和谐。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0KWpOsU2BZ54q0grWJ8Q0jNjb8thDfWMUP8RKZIiEATv8PL-MgL8VvVlgKpivhmUdK7QKi5fMLq1mdwFr74A9seG9z9xBPPSxAb0RFqhY1qL9FjMeKD5FZyCfv0YR8CsZsxTM9QkCa5fJjK_3oOu78qpznxSj4fa-_SFU3oTU6c1Mp38uN-dY26VnD_vCFcAkVHwA7Tm0gfqTfRm8jycv9pbsgLwfD4gEGabKtdlzjspu9jEEOod3menlY-5SyiFa6Xh6SYbFkxbJ'
  },
  {
    id: 'magician',
    name: '魔术师',
    englishName: 'The Magician',
    arcana: 'Major Arcana I',
    element: 'Air',
    description: '魔术师代表着创造力、行动和意志。他拥有将想法转化为现实的所有工具。',
    uprightKeywords: ['创造力', '行动', '意志', '熟练'],
    reversedKeywords: ['操纵', '未开发的潜力', '欺骗', '犹豫'],
    symbolism: ['无限符号：永恒的能量。', '四要素工具：物质世界的掌控。', '指向天地的手势：如其在上，如其在下。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKY4fU-hU7DFjRtos0txC5u9Sizo1XG4ZPCimcZQwceegOW20WIxGSUlCkSI8mTetL7QkNlkwSHdtz5fNl4edj-Ny7m-wJUHXKBfsl1k-SPf07-YQSkBTCYWNBXWPYGmxy5dP9qtfCcwGbuV0IcBcIC2Ak5vm97982OwBT9RDjl1uQMK_0-65tfnSN64SbWUDKeeY28FjkYd-hMzB-GFMnuZmwf5NJYEb6kmR8e7zKkcYnPbHJ4weyuLf02O--LIKfnYs64BQSwgT6'
  },
  {
    id: 'empress',
    name: '皇后',
    englishName: 'The Empress',
    arcana: 'Major Arcana III',
    element: 'Earth',
    description: '皇后代表着丰饶、自然和母性。她是生命的创造者和滋养者。',
    uprightKeywords: ['丰饶', '自然', '母性', '感官'],
    reversedKeywords: ['创造力受阻', '依赖', '空虚', '过度保护'],
    symbolism: ['石榴：多产。', '皇冠：权威。', '森林：自然的生命力。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRIhG_YWPNkisKaup_sj4iP3QS__T5kf85_ZY3ukbuYtCY6DzgFwnwVXCjIzMivbt97hbtH1HuzEnHN5h9-vBAiO8cu8TcApJ_rWTymuBDh9OZl6MhGCwZwGWLkCQiazEAmzQEue8L7jkfkQEOLUjFnp5r3J4SP-MUjbQWSaox4p8zfrwUj9oPY_hYXlE3u8KHYdxuwejj-v0z-Itst5Pp3jq_R2GQFWZ1noWnbyy75Nv9sxNo-l0ketwgd9u36J0048yP_-CiWDAR'
  },
  {
    id: 'emperor',
    name: '皇帝',
    englishName: 'The Emperor',
    arcana: 'Major Arcana IV',
    element: 'Fire',
    description: '皇帝代表着权威、结构和父亲形象。他是秩序的维护者和保护者。',
    uprightKeywords: ['权威', '结构', '秩序', '保护'],
    reversedKeywords: ['专制', '缺乏纪律', '僵化', '软弱'],
    symbolism: ['公羊头：白羊座的能量。', '权杖：统治权。', '盔甲：防御和准备。'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBklOCEawbOgLZNV7sfCVMG-sGdtB2qN7vR7Joeu75V8u0lF_p9QotS2uSqp2ptSqcpJcfPDgwNZJA8Cn4LXSps0WxGXUxe0eHolbXOSvidq7jFUthuVpLbo-XQQWtTKTpy_FKLq1HsEMqOxuwZmOsFQJS0_St_C8OSotW2-XBC0hzvSLTRfcL_ZJwmf0fnezBWGPv6ZRZbuAwSCKELSZVnS16JedTbFMwmR5_5cd6Pz7soszmXldIroBpJM5OgmaiI1BTQOVltZyNl'
  }
];

export const SPREADS: Spread[] = [
  {
    id: 'single',
    name: '单牌启示',
    englishName: 'Single Card',
    description: '针对当下的能量或简单的问题，提供直接且纯粹的指引。',
    icon: 'filter_1',
    positions: [
      { id: 'focus', name: '核心指引', description: '问题的核心能量。' }
    ]
  },
  {
    id: 'holy-triangle',
    name: '圣三角形',
    englishName: 'Holy Triangle',
    description: '洞察问题的过去、现在与未来，理解因果循环的深度逻辑。',
    icon: 'change_history',
    positions: [
      { id: 'past', name: '过去 (Root)', description: '根基与起源。' },
      { id: 'present', name: '现在 (Path)', description: '当下的交点。' },
      { id: 'future', name: '未来 (Sky)', description: '潜在的流向。' }
    ]
  },
  {
    id: 'celtic-cross',
    name: '赛尔特十字',
    englishName: 'Celtic Cross',
    description: '全方位的命运剖析，涵盖潜意识、外界环境及最终结果。',
    icon: 'grid_view',
    positions: [
      { id: 'core', name: '核心', description: '问题的现状。' },
      { id: 'challenge', name: '挑战', description: '面临的阻碍。' },
      { id: 'conscious', name: '意识', description: '你的目标和想法。' },
      { id: 'unconscious', name: '潜意识', description: '深层的影响。' },
      { id: 'past', name: '过去', description: '已发生的事情。' },
      { id: 'future', name: '未来', description: '即将发生的事情。' },
      { id: 'self', name: '自我', description: '你的态度。' },
      { id: 'environment', name: '环境', description: '外部的影响。' },
      { id: 'hopes', name: '希望与恐惧', description: '你的内心期待。' },
      { id: 'outcome', name: '结果', description: '最终的发展。' }
    ]
  }
];

export const CARD_BACK_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ5qfZ_tC9eu7tMl4jNchwH7eG-LhduNDIomhnaD2-3eHNq38F47elEnvrTAzM_j6Ht16KTaAEpTyjpyBCvTCH9P1JRPZuYQzgF9zk9R4ry6WfC_JO8MPb_dRBt5DX4dHLHUWGKtwcV-alZSxcUDo-64V9oD9o0T1JdY5N1YWwHxyD6yiOzVJOG2ek_80OOBRtHaRQsGex9z9jo5xgc2U_BaDdh99j2cO0XyK1NdeLLwfuY2AYAC2PLDEiWuxdQshvc3qnTGg-F6o7';

export const HISTORY_THUMBNAIL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSlNznSxIu7WuOoxcEEfVuzf0rnx-2tut032cZfimcZNo8AOmjM-H4Vot7Vb72v36SHTzqWLzmtJSYCO9B8bq8mlIoyVugdlbeHH7m7YjXUF1rvoxA0XDfHwYs8jBXszmjE6-CMLBPq3aH1LLDmPW7AH5nP3qHSerfzFD4in0mW9CE23AAIVn-vANEv6HAZlq2UOZxI4W0oqs9wcsJc-u-jUmQHgNIjnE-It8Ei93R0zixucnZDlV2MTTmlRBYremEFCmI9KxeeclQ';
