import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Table } from 'antd';
import column from './Column';

class ResultTable extends Component {
    render() {
        return (
            <Table dataSource={this.props.dataSource} columns={column.columnType} />
        );
    }
}

ResultTable.propTypes = {
    dataSource: PropTypes.array.isRequired
};

export default ResultTable;