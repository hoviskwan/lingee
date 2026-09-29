const STAGE_ROLES = {
  '需求分析': 'product',
  '方案设计': 'development',
  '实现规划': 'development',
  '编码实现': 'development',
  '测试验证': 'testing',
  '部署交付': 'development',
};

function profileRole(person) {
  const roles = (person?.roles || []).map(role => role.text);
  if (roles.includes('产品') || roles.includes('需求') || person?.dept === '产品部') return 'product';
  if (roles.includes('测试') || person?.dept === '测试部') return 'testing';
  if (roles.includes('开发') || roles.includes('架构') || person?.dept === '研发部') return 'development';
  return '';
}

export function defaultStageAssigneeId(project, members, profiles, stageName) {
  const expectedRole = STAGE_ROLES[stageName];
  if (!project || !expectedRole) return '';
  const match = members.find(member => {
    const explicitRole = project.memberRoles?.[member.id];
    const role = explicitRole === undefined ? profileRole(profiles.find(person => person.id === member.id)) : explicitRole;
    return role === expectedRole;
  });
  return match?.id || '';
}
