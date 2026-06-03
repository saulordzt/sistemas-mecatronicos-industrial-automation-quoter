export function notFound(reply, entity = 'Record') {
  return reply.code(404).send({ message: `${entity} not found` });
}

export function deleted(reply) {
  return reply.code(204).send();
}
