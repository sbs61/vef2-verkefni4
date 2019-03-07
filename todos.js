/* eslint-disable import/no-extraneous-dependencies */
/* todo útfæra virkni */
const xss = require('xss');
const validator = require('validator');
const { query } = require('./db');

async function list(order, completed) {
  if (completed !== undefined) {
    const result = await query(`SELECT * FROM projects WHERE completed=${completed} ORDER BY ${order}`);
    return result.rows;
  }

  const result = await query(`SELECT * FROM projects ORDER BY ${order}`);
  return result.rows;
}

function isEmpty(s) {
  return s == null && !s;
}

function validate(title, due, position, completed) {
  const errors = [];

  if (!isEmpty(title)) {
    if (typeof title !== 'string' || title.length === 0) {
      errors.push({
        field: 'title',
        error: 'Titill verður að vera strengur sem er 1 til 128 stafir',
      });
    }
  }

  if (!isEmpty(due)) {
    if (!validator.isISO8601(due) && due.length !== 0) {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (!validator.isInt(position)) {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jöfn 0',
      });
    }
  }

  if (!isEmpty(completed)) {
    if (!validator.isBoolean(completed)) {
      errors.push({
        field: 'completed',
        error: 'Lokið verður að vera boolean gildi',
      });
    }
  }

  return errors;
}

function validateNew(title, due, position, completed) {
  const errors = [];

  if (isEmpty(title)) {
    errors.push({
      field: 'title',
      error: 'Verður að skilgreina title',
    });
  }

  if (isEmpty(due)) {
    errors.push({
      field: 'due',
      error: 'Verður að skilgreina dagsetningu',
    });
  }

  if (isEmpty(position)) {
    errors.push({
      field: 'position',
      error: 'Verður að skilgreina staðsetningu',
    });
  }

  if (isEmpty(completed)) {
    errors.push({
      field: 'completed',
      error: 'Verður að skilgreina stöðu',
    });
  }

  return errors;
}

async function getOne(id) {
  const result = await query('SELECT * FROM projects WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
    };
  }

  return result.rows;
}

async function createNew(title, due, position, completed) {
  const validationResult1 = validateNew(title, due, position, completed);

  if (validationResult1.length > 0) {
    return {
      success: false,
      validation: validationResult1,
    };
  }

  const validationResult2 = validate(title, due, position, completed);

  if (validationResult2.length > 0) {
    return {
      success: false,
      validation: validationResult2,
    };
  }

  const values = [title, due, position, completed];

  const newProject = await query('INSERT INTO projects(title, due, position, completed) VALUES($1, $2, $3, $4)', values);

  return {
    newProject,
    success: true,
  };
}

/**
 * Updates an item, either its title, text or both.
 *
 * @param {number} id Id of item to update
 * @param {object} item Item to update
 * @returns {object}
 */
async function update(id, item) {
  const result = await query('SELECT * FROM projects WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
      validation: [],
    };
  }

  const validationResult = validate(item.title, item.due, item.position, item.completed);

  if (validationResult.length > 0) {
    return {
      success: false,
      notFound: false,
      validation: validationResult,
    };
  }

  const changedColumns = [
    !isEmpty(item.title) ? 'title' : null,
    !isEmpty(item.due) ? 'due' : null,
    !isEmpty(item.position) ? 'position' : null,
    !isEmpty(item.completed) ? 'completed' : null,
  ].filter(Boolean);

  const changedValues = [
    !isEmpty(item.title) ? xss(item.title) : null,
    !isEmpty(item.due) ? xss(item.due) : null,
    !isEmpty(item.position) ? xss(item.position) : null,
    !isEmpty(item.completed) ? xss(item.completed) : null,
  ].filter(Boolean);

  console.log(changedValues);

  const updates = [id, ...changedValues];

  const updatedColumnsQuery = changedColumns
    .map((column, i) => `${column} = $${i + 2}`);

  console.log(`updates: ${updates}`);
  console.log(updatedColumnsQuery); 

  const q = `
    UPDATE projects
    SET ${updatedColumnsQuery.join(', ')}
    WHERE id = $1
    RETURNING id, title, due, position, completed`;
  console.log(q);

  const updateResult = await query(q, updates);
  console.log(updateResult);
  return {
    success: true,
    item: updateResult.rows[0],
  };
}

async function deleteProject(id) {
  const check = await query('SELECT * FROM projects WHERE id = $1', [id]);

  if (check.rows.length === 0) {
    return {
      success: false,
      notFound: true,
    };
  }

  const q = 'DELETE FROM projects WHERE id = $1';

  query(q, [id]);

  return {
    success: true,
    notFound: false,
    message: 'Project deleted',
  };
}

module.exports = {
  /* todo exporta virkni */
  list,
  update,
  getOne,
  createNew,
  deleteProject,
};
