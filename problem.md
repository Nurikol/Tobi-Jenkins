### done
1. build
    - 普通构建
    - 带参数的构建
        - 弹出dialog输入参数
2. 可读格式时间显示
3. 模糊匹配job名，不需完整输入，提示匹配到的完整job名
    -  如果有多个匹配到的job名，通过点击按钮触发
    -  按钮点击完会更新信息，提示哪个job被选择
4. 状态返回
    - Freestyle Job返回开始信息和结束信息
    - Pipeline返回每个stage的信息
    - 提供console链接
5. 用户配置
    - hosturl，账号，密码
6. 测试报告信息 
7. 触发Build后可通过点击按钮停止此次构建
    - 点击按钮会会根据build状态进行相应提示

### to do list
1. Jenkinsfile pipeline modification
2. deployment

### blocker
1. console output信息返回：各个job的信息不同，不能确定返回的信息大小
