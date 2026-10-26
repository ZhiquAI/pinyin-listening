# 拼音词语插画

本次使用内置 image_gen，根据用户提供的样图生成 99 张独立 PNG 插画：暖米色纸感、彩铅水彩质感、柔和儿童绘本风格。

- 图片：../../public/images/vocabulary/
- 词语到图片 URL 映射：../../public/images/vocabulary/image-map.json
- 图片清单与校验：manifest.json、validation.json
- 完整提示词：prompts.json
- 带中文词语的预览：preview-01.jpg、preview-02.jpg、preview-03.jpg

涵盖题库 97 个不同的中文词语，以及学习卡中的“火”“洗手”。纯字母和带调单韵母不配词义插画。

“句子”和“橘子”分别使用 juzi-1.png、juzi-2.png，避免同音文件名冲突。鸭梨配真正的梨，萝卜配白萝卜。抽象词和亲属关系仍需文字与读音共同解释，不能把图片当成独立释义。

本次交付图片资产和映射，尚未修改应用代码接入图片。
