/* eslint-disable no-console */

/* todo útfæra virkni */
const xss = require('xss');
const validator = require('validator');
const { query } = require('./db');

/**
 * Get a list of all projects in the database and sort them approprietly.
 *
 * @param {string} order Order of projects, either ascending or descending order
 * @param {boolean} completed completion status of the project.
 */
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
    if (!validator.isISO8601(due) && due !== '') {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (!validator.isInt(position) && position !== '') {
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

/**
 * Check if title is defined
 *
 * @param {string} title title of the project that needs to be validated
 */
function validateTitle(title) {
  const errors = [];

  if (isEmpty(title)) {
    errors.push({
      field: 'title',
      error: 'Verður að skilgreina title',
    });
  }

  return errors;
}

/**
 * Returns a project with a certain id
 *
 * @param {number} id Id of project to get
 */
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

/**
 * Creates a new project and adds it to the database.
 *
 * @param {string} title title of project
 * @param {string} due due date of project
 * @param {number} position position of project
 * @param {boolean} completed is the project completed or not
 */
async function createNew(title, due, position, completed) {
  const validationTitle = validateTitle(title);

  if (validationTitle.length > 0) {
    return {
      success: false,
      validation: validationTitle,
    };
  }

  const validationResult = validate(title, due, position, completed);

  if (validationResult.length > 0) {
    return {
      success: false,
      validation: validationResult,
    };
  }

  if (completed === undefined) {
    const values = [title, due, position];
    await query('INSERT INTO projects(title, due, position) VALUES($1, $2, $3)', values);
  } else {
    const values = [title, due, position, completed];
    await query('INSERT INTO projects(title, due, position, completed) VALUES($1, $2, $3, $4)', values);
  }

  const newProject = await query('SELECT * FROM projects ORDER BY id DESC LIMIT 1');

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
    !isEmpty(item.due) && item.due !== '' ? 'due' : null,
    !isEmpty(item.position) && item.position !== '' ? 'position' : null,
    !isEmpty(item.completed) ? 'completed' : null,
  ].filter(Boolean);

  console.log(`dálkar: ${changedColumns}`);


  const changedValues = [
    !isEmpty(item.title) ? xss(item.title) : null,
    !isEmpty(item.due) && item.due !== '' ? xss(item.due) : null,
    !isEmpty(item.position) && item.position !== '' ? xss(item.position) : null,
    !isEmpty(item.completed) ? xss(item.completed) : null,
  ].filter(Boolean);

  console.log(`values ${changedValues}`);

  const updates = [id, ...changedValues];

  const updatedColumnsQuery = changedColumns
    .map((column, i) => `${column} = $${i + 2}`);

  console.log(`updates: ${updates}`);
  console.log(updatedColumnsQuery);

  if (item.position === '') {
    await query(
      `UPDATE projects
    SET position = NULL
    WHERE id = $1`, [id],
    );
  }

  if (item.due === '') {
    await query(
      `UPDATE projects
    SET due = NULL
    WHERE id = $1`, [id],
    );
  }

  if (updatedColumnsQuery.length > 0) {
    await query(`
    UPDATE projects
    SET ${updatedColumnsQuery.join(', ')}
    WHERE id = $1
    RETURNING id, title, due, position, completed, created, updated`, updates);
  }

  const updateResult = await query('SELECT * FROM projects WHERE id = $1', [id]);
  return {
    success: true,
    item: updateResult.rows[0],
  };
}

/**
 * Deletes project with given id from the database.
 *
 * @param {number} id Id of project that is to be deleted.
 */
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
    message: 'Verkefni eytt',
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
