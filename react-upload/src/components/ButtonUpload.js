import React from 'react';
import PropTypes from 'prop-types';
import { Button, Icon } from 'antd';

const ButtonUpload = ({ showConfirm, disabled }) => (
    <Button
        type="primary"
        onClick={showConfirm}
        disabled={disabled}
    >
        <Icon type="upload" />Upload
    </Button>
);

ButtonUpload.propTypes = {
    showConfirm: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired
};

export default ButtonUpload;